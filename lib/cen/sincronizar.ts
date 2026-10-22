// Trae las órdenes nuevas de los SFTP, las guarda y las cruza con los maestros:
//   - cen_puntos_ean: EAN del punto de entrega → NIT, sucursal y razón social de Siesa
//   - cen_productos: EAN del ítem → peso, para calcular el peso de la orden
// Una orden cuyo punto de entrega no está homologado queda en estado "sin_punto" (en pantalla: "Por revisar").
import { sql } from '@/lib/db'
import { parsearOrden, type FuenteEdi, type OrdenEdi } from './parser'
import { conSftp, fuenteConfigurada, FUENTES } from './sftp'
import { recalcularRutas } from './rutas'
import { actualizarItemsSiNecesario } from './itemsSiesa'
import { siesaConfigurado } from '@/lib/siesa/connekta'

// Tope por ejecución para no pasar el tiempo máximo de la función en Vercel;
// lo que quede se trae en la siguiente sincronización.
const MAX_ARCHIVOS_POR_FUENTE = 40

export interface ResultadoFuente {
  fuente: FuenteEdi
  configurada: boolean
  nuevas: number
  actualizadas: number
  omitidas: number // la orden ya se envió a Siesa: no se toca
  porRevisar: string[] // órdenes que quedaron sin sucursal asociada
  errores: { archivo: string; error: string }[]
  pendientesPorTraer: number
  error?: string
}

async function guardarOrden(fuente: FuenteEdi, archivoId: number, o: OrdenEdi): Promise<{ resultado: 'nueva' | 'actualizada' | 'omitida'; porRevisar: boolean }> {
  const [existente] = await sql`
    SELECT id, estado FROM cen_ordenes WHERE ean_comprador = ${o.eanComprador} AND numero_orden = ${o.numeroOrden}
  `
  // Si el pedido ya se creó en Siesa, una nueva versión de la orden no lo modifica.
  if (existente?.estado === 'enviado') return { resultado: 'omitida', porRevisar: false }

  const [punto] = await sql`SELECT nit, sucursal, razon_social FROM cen_puntos_ean WHERE ean = ${o.eanEntrega} AND activo = TRUE`
  const eans = o.lineas.map(l => l.eanItem)
  // Peso del producto de la cadena (cen_productos_comprador) si existe; si no, el del maestro.
  const productos = await sql`
    SELECT e AS ean, COALESCE(c.peso_kg, p.peso_kg) AS peso_kg
    FROM unnest(${eans}::text[]) AS e
    LEFT JOIN cen_productos p ON p.ean = e
    LEFT JOIN cen_productos_comprador c ON c.ean = e AND c.ean_comprador = ${o.eanComprador}
    WHERE p.ean IS NOT NULL OR c.ean IS NOT NULL
  `
  const pesoPorEan = new Map(productos.map(p => [p.ean as string, Number(p.peso_kg)]))
  const todosConPeso = eans.every(e => pesoPorEan.has(e))

  const unidades = o.lineas.reduce((s, l) => s + l.cantidad, 0)
  const valor = o.lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)
  // Si algún producto no está en el maestro, el peso queda vacío (no se muestra un peso incompleto).
  const peso = todosConPeso ? o.lineas.reduce((s, l) => s + l.cantidad * (pesoPorEan.get(l.eanItem) ?? 0), 0) : null
  const estado = punto ? 'pendiente' : 'sin_punto'

  // Líneas y reparto por tienda en una sola sentencia; la orden se ubica por su
  // clave única (comprador + número), así funciona igual para orden nueva o existente.
  // Si hay líneas con el mismo número, el reparto va a la última, como antes.
  const reparto = o.lineas.flatMap(l => l.distribucion.map(d => ({ nro: l.nroLinea, ...d })))
  const qLineas = sql`
    WITH ord AS (SELECT id FROM cen_ordenes WHERE ean_comprador = ${o.eanComprador} AND numero_orden = ${o.numeroOrden}),
    lin AS (
      INSERT INTO cen_orden_lineas (orden_id, nro_linea, ean_item, cod_comprador, descripcion, cantidad, precio, iva)
      SELECT ord.id, n, e, c, d, q, p, i FROM ord, unnest(
        ${o.lineas.map(l => l.nroLinea)}::int[], ${o.lineas.map(l => l.eanItem)}::text[],
        ${o.lineas.map(l => l.codComprador)}::text[], ${o.lineas.map(l => l.descripcion)}::text[],
        ${o.lineas.map(l => l.cantidad)}::numeric[], ${o.lineas.map(l => l.precio)}::numeric[],
        ${o.lineas.map(l => l.iva)}::numeric[]
      ) AS t(n, e, c, d, q, p, i)
      RETURNING id, nro_linea
    )
    INSERT INTO cen_orden_distribucion (linea_id, ean_local, cantidad)
    SELECT ul.id, r.loc, r.cant
    FROM (SELECT DISTINCT ON (nro_linea) id, nro_linea FROM lin ORDER BY nro_linea, id DESC) ul
    JOIN unnest(${reparto.map(r => r.nro)}::int[], ${reparto.map(r => r.eanLocal)}::text[], ${reparto.map(r => r.cantidad)}::numeric[])
      AS r(nro, loc, cant) ON r.nro = ul.nro_linea
  `

  // Encabezado, líneas y reparto en una transacción (AUD-22): antes, si fallaba la
  // inserción de líneas después de borrar las anteriores, la orden quedaba sin líneas.
  if (existente) {
    await sql.transaction([
      sql`
        UPDATE cen_ordenes SET
          fuente = ${fuente}, archivo_id = ${archivoId}, fecha_orden = ${o.fechaOrden}, fecha_entrega = ${o.fechaEntrega},
          fecha_entrega_max = ${o.fechaEntregaMax}, ean_entrega = ${o.eanEntrega},
          nit = ${punto?.nit ?? null}, sucursal = ${punto?.sucursal ?? null}, razon_social = ${punto?.razon_social ?? null},
          total_unidades = ${unidades}, valor_total = ${valor}, peso_kg = ${peso},
          estado = CASE WHEN estado = 'descartada' THEN estado ELSE ${estado} END, updated_at = NOW()
        WHERE id = ${existente.id}
      `,
      sql`DELETE FROM cen_orden_lineas WHERE orden_id = ${existente.id}`,
      qLineas,
    ])
  } else {
    await sql.transaction([
      sql`
        INSERT INTO cen_ordenes (fuente, archivo_id, numero_orden, fecha_orden, fecha_entrega, fecha_entrega_max,
          ean_comprador, ean_entrega, nit, sucursal, razon_social, total_unidades, valor_total, peso_kg, estado)
        VALUES (${fuente}, ${archivoId}, ${o.numeroOrden}, ${o.fechaOrden}, ${o.fechaEntrega}, ${o.fechaEntregaMax},
          ${o.eanComprador}, ${o.eanEntrega}, ${punto?.nit ?? null}, ${punto?.sucursal ?? null}, ${punto?.razon_social ?? null},
          ${unidades}, ${valor}, ${peso}, ${estado})
      `,
      qLineas,
    ])
  }
  return { resultado: existente ? 'actualizada' : 'nueva', porRevisar: !punto }
}

async function sincronizarFuente(fuente: FuenteEdi): Promise<ResultadoFuente> {
  const r: ResultadoFuente = { fuente, configurada: fuenteConfigurada(fuente), nuevas: 0, actualizadas: 0, omitidas: 0, porRevisar: [], errores: [], pendientesPorTraer: 0 }
  if (!r.configurada) return r

  try {
    await conSftp(fuente, async ({ listar, leer }) => {
      const remotos = await listar()
      const procesados = await sql`SELECT nombre FROM cen_archivos WHERE fuente = ${fuente}`
      const yaLeidos = new Set(procesados.map(p => p.nombre as string))
      const nuevos = remotos.filter(a => !yaLeidos.has(a.nombre)).sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      r.pendientesPorTraer = Math.max(0, nuevos.length - MAX_ARCHIVOS_POR_FUENTE)

      for (const a of nuevos.slice(0, MAX_ARCHIVOS_POR_FUENTE)) {
        let contenido = ''
        try {
          contenido = await leer(a.nombre)
          const orden = parsearOrden(contenido)
          const [archivo] = await sql`
            INSERT INTO cen_archivos (fuente, nombre, tamano, fecha_archivo, estado, contenido)
            VALUES (${fuente}, ${a.nombre}, ${a.tamano}, ${a.fecha.toISOString()}, 'ok', ${contenido})
            RETURNING id
          `
          const { resultado, porRevisar } = await guardarOrden(fuente, archivo.id, orden)
          if (resultado === 'nueva') r.nuevas++
          else if (resultado === 'actualizada') r.actualizadas++
          else r.omitidas++
          if (porRevisar) r.porRevisar.push(`OC ${orden.numeroOrden} (EAN ${orden.eanEntrega})`)
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e)
          r.errores.push({ archivo: a.nombre, error })
          // Queda registrado con su error para revisarlo, y no se reintenta en cada sincronización.
          await sql`
            INSERT INTO cen_archivos (fuente, nombre, tamano, fecha_archivo, estado, error, contenido)
            VALUES (${fuente}, ${a.nombre}, ${a.tamano}, ${a.fecha.toISOString()}, 'error', ${error}, ${contenido || null})
            ON CONFLICT (fuente, nombre) DO UPDATE SET estado = 'error', error = EXCLUDED.error
          `
        }
      }
    })
  } catch (e) {
    r.error = e instanceof Error ? e.message : String(e)
  }
  return r
}

export async function sincronizarOrdenes(): Promise<ResultadoFuente[]> {
  const resultados: ResultadoFuente[] = []
  for (const f of FUENTES) resultados.push(await sincronizarFuente(f))
  await recalcularRutas()
  // Ítems de Siesa (cada 12 h) para asignar el f120_id de productos nuevos; si Siesa falla, la sincronización sigue.
  if (siesaConfigurado()) await actualizarItemsSiNecesario().catch(e => console.error('Ítems Siesa:', e))
  return resultados
}
