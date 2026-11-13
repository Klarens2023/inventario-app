// Aviso por correo a facturación de los pedidos creados en Siesa.
//
//   - Individual: al crear un pedido desde el detalle de la orden.
//   - En bloque: al terminar "Enviar N a Siesa", un solo correo con todos los creados.
//   - Manual: botón "Avisar a facturación" de cada ruta, con lo que esté pendiente de avisar
//     (sirve si un aviso falló o para los institucionales agregados después).
// Siempre se agregan los pedidos institucionales sin avisar de las mismas relaciones (ruta + semana),
// para que facturación reciba la relación completa. Cada pedido se avisa una sola vez
// (aviso_facturacion_at; columnas de scripts/migrate-add-cen-aviso-facturacion.js).
//
// Destinatarios: CORREO_FACTURACION_PARA y CORREO_FACTURACION_CC (separados por coma).
import { sql } from '@/lib/db'
import { correoConfigurado, enviarCorreo, listaCorreos } from '@/lib/correo'
import { logAudit } from '@/lib/audit'
import { codigoRelacion } from './relacion'
import { nombreComprador } from './compradores'
import { FUENTE_INSTITUCIONAL } from './institucional'
import { armarCorreoFacturacion, type LineaAviso, type PedidoAviso } from './correoFacturacion'

/** Pedido incluido en el correo, para mostrarlo en pantalla (ResultadoEnvioModal). */
export type PedidoAvisado = Pick<PedidoAviso, 'id' | 'pedido' | 'oc' | 'institucional' | 'razon_social' | 'relacion' | 'valor' | 'retenido'>

export interface ResultadoAviso {
  ok: boolean
  mensaje: string
  pedidos: string[]
  /** Pedidos que fueron en el correo (vacío si no se envió). */
  detalle?: PedidoAvisado[]
  /** A quién se envió. */
  para?: string[]
  cc?: string[]
}

export function destinatariosFacturacion() {
  return { para: listaCorreos(process.env.CORREO_FACTURACION_PARA), cc: listaCorreos(process.env.CORREO_FACTURACION_CC) }
}

/** Por qué no se puede avisar (falta configuración), o null si está listo. */
export function avisoNoDisponible(): string | null {
  if (!correoConfigurado()) return 'El correo no está configurado (CORREO_SMTP_USER y CORREO_SMTP_PASSWORD en Vercel).'
  if (!destinatariosFacturacion().para.length) return 'Faltan los destinatarios de facturación (CORREO_FACTURACION_PARA en Vercel).'
  return null
}

type Fila = PedidoAviso

async function pedidosSinAviso(filtro: { ids?: number[]; rutas?: string[] }): Promise<Fila[]> {
  const ids = filtro.ids ?? null
  const rutas = filtro.rutas ?? null
  const filas = await sql`
    SELECT o.id, o.siesa_consecutivo, o.numero_orden, o.fuente, o.ean_comprador, o.razon_social, o.nit, o.sucursal, pe.ciudad,
           o.ruta, o.fecha_entrega::text, o.total_unidades::float AS unidades, o.peso_kg::float AS peso_kg,
           o.valor_total::float AS valor, o.siesa_retenido, o.enviado_por,
           COALESCE(o.fecha_despacho, COALESCE(o.fecha_entrega, o.fecha_entrega_max) - COALESCE(rt.dias_transito, 0))::text AS fecha_despacho
    FROM cen_ordenes o
    LEFT JOIN cen_puntos_ean pe ON pe.ean = o.ean_entrega
    LEFT JOIN cen_rutas rt ON rt.ruta = o.ruta
    WHERE o.estado = 'enviado' AND o.aviso_facturacion_at IS NULL
      AND (${ids}::int[] IS NULL OR o.id = ANY(${ids}::int[]))
      AND (${rutas}::text[] IS NULL OR o.ruta = ANY(${rutas}::text[]))
    ORDER BY o.fecha_entrega NULLS LAST, o.razon_social, o.siesa_consecutivo`
  return filas.map(f => {
    const institucional = f.fuente === FUENTE_INSTITUCIONAL
    return {
      id: f.id as number,
      pedido: (f.siesa_consecutivo ?? f.numero_orden) as string,
      oc: institucional ? null : f.numero_orden as string,
      institucional,
      cadena: institucional ? 'Institucional' : nombreComprador(f.ean_comprador as string),
      razon_social: (f.razon_social ?? '') as string,
      nit: f.nit as string | null, sucursal: f.sucursal as string | null, ciudad: f.ciudad as string | null,
      ruta: f.ruta as string | null,
      relacion: codigoRelacion(f.ruta as string | null, f.fecha_despacho as string | null) ?? 'Sin ruta',
      fecha_entrega: f.fecha_entrega as string | null,
      unidades: Number(f.unidades) || 0, peso_kg: f.peso_kg === null ? null : Number(f.peso_kg), valor: Number(f.valor) || 0,
      retenido: f.siesa_retenido as string | null, creado_por: f.enviado_por as string | null,
    }
  })
}

/** Qué avisar: pedidos puntuales o todo lo pendiente de una ruta. */
export interface SeleccionAviso {
  ids?: number[]
  ruta?: string
  soloSeleccion?: boolean // true: solo los pedidos indicados (los PVK se eligen a mano en la selección)
  totales?: boolean // incluir en el correo los totales por ítem y por cliente de cada relación
}

/**
 * Pedidos a avisar: los indicados (por id o todos los pendientes de una ruta) más, salvo soloSeleccion,
 * los institucionales sin avisar de las mismas relaciones.
 */
export async function seleccionarParaAviso(sel: SeleccionAviso): Promise<PedidoAviso[]> {
  const base = sel.ids ? await pedidosSinAviso({ ids: sel.ids }) : sel.ruta ? await pedidosSinAviso({ rutas: [sel.ruta] }) : []
  if (!base.length || sel.soloSeleccion) return base
  const rutas = Array.from(new Set(base.map(p => p.ruta).filter((r): r is string => Boolean(r))))
  const relaciones = new Set(base.map(p => p.relacion))
  const yaEstan = new Set(base.map(p => p.id))
  const institucionales = rutas.length
    ? (await pedidosSinAviso({ rutas })).filter(p => p.institucional && relaciones.has(p.relacion) && !yaEstan.has(p.id))
    : []
  return [...base, ...institucionales]
}

// Líneas de los pedidos para los totales por ítem y por cliente (ítem y peso del maestro, vista cen_lineas_producto)
async function lineasDePedidos(ids: number[]): Promise<LineaAviso[]> {
  const filas = await sql`
    SELECT l.orden_id, l.ean_item, p.f120_id, COALESCE(p.descripcion, l.descripcion, l.ean_item) AS descripcion,
           l.cantidad::float AS cantidad, l.precio::float AS precio, l.unidad, p.peso_kg::float AS peso_unitario
    FROM cen_orden_lineas l JOIN cen_lineas_producto p ON p.linea_id = l.id
    WHERE l.orden_id = ANY(${ids}::int[])
    ORDER BY l.orden_id, l.nro_linea`
  return filas.map(f => {
    const item = (f.f120_id as number | null) ?? (Number(/^SIESA-(\d+)$/.exec(String(f.ean_item))?.[1]) || null)
    const enKg = String(f.unidad ?? '').toUpperCase() === 'KG'
    const cantidad = Number(f.cantidad) || 0
    return {
      orden_id: f.orden_id as number, item, descripcion: String(f.descripcion), unidad: enKg ? 'KG' : 'UND',
      cantidad, valor: cantidad * (Number(f.precio) || 0),
      kg: enKg ? cantidad : f.peso_unitario === null ? null : cantidad * Number(f.peso_unitario),
    }
  })
}

/** Envía el correo y marca los pedidos como avisados. Nunca lanza: devuelve el resultado para mostrarlo. */
export async function avisarFacturacion(sel: SeleccionAviso, usuario: { id: string | null; name: string }): Promise<ResultadoAviso> {
  const falta = avisoNoDisponible()
  if (falta) return { ok: false, mensaje: `No se avisó a facturación: ${falta}`, pedidos: [] }
  try {
    const pedidos = await seleccionarParaAviso(sel)
    if (!pedidos.length) return { ok: true, mensaje: 'No hay pedidos pendientes de avisar a facturación.', pedidos: [] }
    const { para, cc } = destinatariosFacturacion()
    const lineas = sel.totales ? await lineasDePedidos(pedidos.map(p => p.id)) : undefined
    const correo = armarCorreoFacturacion(pedidos, { avisadoPor: usuario.name, urlApp: process.env.NEXTAUTH_URL, lineas })
    await enviarCorreo({ para, cc, ...correo })
    const ids = pedidos.map(p => p.id)
    await sql`UPDATE cen_ordenes SET aviso_facturacion_at = NOW(), aviso_facturacion_por = ${usuario.name.slice(0, 120)}
              WHERE id = ANY(${ids}::int[]) AND aviso_facturacion_at IS NULL`
    const nombres = pedidos.map(p => p.pedido)
    await logAudit({
      usuarioId: usuario.id, usuarioNombre: usuario.name, accion: 'CEN_AVISO_FACTURACION',
      descripcion: `Avisó a facturación ${pedidos.length} pedido(s): ${nombres.join(', ')}`,
      datos: { pedidos: nombres, para, cc },
    })
    const inst = pedidos.filter(p => p.institucional).length
    return {
      ok: true, mensaje: `Se avisó a facturación ${pedidos.length} pedido(s)${inst ? ` (${inst} institucional(es))` : ''}.`, pedidos: nombres,
      detalle: pedidos.map(p => ({ id: p.id, pedido: p.pedido, oc: p.oc, institucional: p.institucional, razon_social: p.razon_social, relacion: p.relacion, valor: p.valor, retenido: p.retenido })),
      para, cc,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const sinColumnas = /aviso_facturacion|siesa_retenido/.test(msg) && /column|columna/i.test(msg)
    console.error('[cen] Aviso a facturación:', msg)
    return {
      ok: false, pedidos: [],
      mensaje: sinColumnas
        ? 'No se avisó a facturación: falta correr scripts/migrate-add-cen-aviso-facturacion.js en la base.'
        : `No se pudo enviar el aviso a facturación: ${msg}. Usa "Avisar a facturación" en la ruta para reintentar.`,
    }
  }
}
