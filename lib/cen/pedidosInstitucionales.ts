// Busca en Siesa pedidos ya creados (últimos 8 días) y los agrega como órdenes institucionales en una ruta.
// Los cálculos están en ./institucional (probados); aquí solo la consulta a Siesa y la base.
// Se consulta la API REAL de Siesa (variables SIESA_REAL_*, ver lib/siesa/connekta.ts); las órdenes EDI siguen en QA.
import { sql } from '@/lib/db'
import { hoyBogota } from '@/lib/fechas'
import { consultarTodo, siesaConfigurado } from '@/lib/siesa/connekta'
import { logAudit } from '@/lib/audit'

const CONEXION = 'real' as const
import { fechaDespacho } from './relacion'
import {
  agruparPedidos, armarOrdenInstitucional, clienteDelPedido, condicionAutomatica, condicionBusqueda, condicionPedido,
  COMPRADOR_INSTITUCIONAL, DIAS_INSTITUCIONAL, FUENTE_INSTITUCIONAL, type ClienteInstitucional, type PedidoSiesaResumen, type ProductoMaestro,
} from './institucional'

export const desdeInstitucional = () => fechaDespacho(hoyBogota(), DIAS_INSTITUCIONAL)!

// Órdenes del sistema que ya tienen estos números de pedido (traídas como institucionales o creadas por la app).
async function yaEnSistema(pedidos: string[]): Promise<Map<string, { id: number; numero_orden: string; ruta: string | null; fuente: string }>> {
  if (!pedidos.length) return new Map()
  const rows = await sql`
    SELECT id, numero_orden, ruta, fuente, siesa_consecutivo FROM cen_ordenes
    WHERE siesa_consecutivo = ANY(${pedidos}::text[])
       OR (ean_comprador = ${COMPRADOR_INSTITUCIONAL} AND numero_orden = ANY(${pedidos}::text[]))`
  return new Map(rows.map(r => [(r.siesa_consecutivo ?? r.numero_orden) as string,
    { id: r.id as number, numero_orden: r.numero_orden as string, ruta: r.ruta as string | null, fuente: r.fuente as string }]))
}

export type PedidoBusqueda = PedidoSiesaResumen & { en_sistema: { id: number; numero_orden: string; ruta: string | null; fuente: string } | null }

export async function buscarPedidos(texto: string): Promise<{ desde: string; pedidos: PedidoBusqueda[]; truncado: boolean }> {
  const desde = desdeInstitucional()
  const condicion = condicionBusqueda(texto, desde)
  if (!condicion) throw new Error('Escribe al menos 3 letras de la razón social, el NIT o el número de pedido')
  const MAX_PAGINAS = 15 // 1.500 líneas
  const filas = await consultarTodo<Record<string, unknown>>('API_v2_Ventas_Pedidos', condicion, MAX_PAGINAS, CONEXION)
  const pedidos = agruparPedidos(filas)
  const existentes = await yaEnSistema(pedidos.map(p => p.pedido))
  return {
    desde,
    pedidos: pedidos.map(p => ({ ...p, en_sistema: existentes.get(p.pedido) ?? null })),
    truncado: filas.length >= MAX_PAGINAS * 100,
  }
}

// Guarda el pedido de Siesa como orden institucional en la ruta (encabezado y líneas en una sola sentencia;
// ON CONFLICT evita duplicarlo si dos procesos lo agregan a la vez). Devuelve el id, o null si ya estaba.
async function guardarPedido(p: PedidoSiesaResumen, ruta: string, agregadoPor: string): Promise<{ id: number | null; lineas: number }> {
  // Producto del maestro por ítem de Siesa (para el peso y las cajas de los reportes)
  const items = Array.from(new Set(p.lineas.map(l => l.f120_id)))
  const prods = await sql`
    SELECT DISTINCT ON (f120_id) f120_id, ean, peso_kg::float AS peso_kg FROM cen_productos
    WHERE f120_id = ANY(${items}::int[]) ORDER BY f120_id, (peso_kg IS NULL), ean`
  const maestro = new Map<number, ProductoMaestro>(prods.map(x => [x.f120_id as number, { ean: x.ean as string, peso_kg: x.peso_kg as number | null }]))
  const o = armarOrdenInstitucional(p, maestro)
  const datos = {
    origen: FUENTE_INSTITUCIONAL, co: p.co, referencia: p.referencia, notas: p.notas, estado_siesa: p.estado_label,
    creado_siesa: p.creado, usuario_siesa: p.usuario, agregado_por: agregadoPor, agregado_at: new Date().toISOString(),
  }

  // Encabezado y líneas en una sola sentencia; ON CONFLICT evita duplicarlo si dos personas lo agregan a la vez
  const [fila] = await sql`
    WITH ord AS (
      INSERT INTO cen_ordenes (fuente, numero_orden, fecha_orden, fecha_entrega, ean_comprador, ean_entrega, nit, sucursal, razon_social,
        total_unidades, valor_total, peso_kg, ruta, ruta_manual, estado, siesa_consecutivo, siesa_respuesta, enviado_at, enviado_por)
      VALUES (${FUENTE_INSTITUCIONAL}, ${o.numero_orden}, ${o.fecha_orden}, ${o.fecha_entrega}, ${COMPRADOR_INSTITUCIONAL}, '',
        ${o.nit}, ${o.sucursal}, ${o.razon_social}, ${o.total_unidades}, ${o.valor_total}, ${o.peso_kg}, ${ruta}, TRUE, 'enviado',
        ${p.pedido}, ${JSON.stringify(datos)}::jsonb,
        -- Hora de creación en Siesa (Colombia) → UTC como el resto de fechas; sin ella, la hora en que se agrega
        COALESCE((${p.creado}::timestamp AT TIME ZONE 'America/Bogota') AT TIME ZONE 'UTC', NOW()),
        ${(p.usuario ? `${p.usuario} (Siesa)` : 'Siesa').slice(0, 120)})
      ON CONFLICT (ean_comprador, numero_orden) DO NOTHING
      RETURNING id
    ), lin AS (
      INSERT INTO cen_orden_lineas (orden_id, nro_linea, ean_item, cod_comprador, descripcion, cantidad, precio, iva, unidad)
      SELECT ord.id, n, e, c, d, q, pr, i, u FROM ord, unnest(
        ${o.lineas.map(l => l.nro_linea)}::int[], ${o.lineas.map(l => l.ean_item)}::text[], ${o.lineas.map(l => l.cod_comprador)}::text[],
        ${o.lineas.map(l => l.descripcion)}::text[], ${o.lineas.map(l => l.cantidad)}::numeric[], ${o.lineas.map(l => l.precio)}::numeric[],
        ${o.lineas.map(l => l.iva)}::numeric[], ${o.lineas.map(l => l.unidad)}::text[]
      ) AS t(n, e, c, d, q, pr, i, u)
      RETURNING orden_id
    )
    SELECT (SELECT id FROM ord) AS id, (SELECT COUNT(*)::int FROM lin) AS lineas`
  return { id: (fila?.id as number | undefined) ?? null, lineas: Number(fila?.lineas ?? 0) }
}

export interface ResultadoAgregar { id: string; pedido: string; ok: boolean; mensaje: string; orden_id?: number }

export async function agregarPedidos(ids: string[], ruta: string, usuario: string): Promise<ResultadoAgregar[]> {
  const desde = desdeInstitucional()
  const resultados: ResultadoAgregar[] = []
  for (const id of ids) {
    const pedidoTxt = id.split('|').slice(1).join('-')
    const r = (ok: boolean, mensaje: string, orden_id?: number) => resultados.push({ id, pedido: pedidoTxt, ok, mensaje, orden_id })
    const condicion = condicionPedido(id)
    if (!condicion) { r(false, 'Pedido inválido'); continue }
    try {
      // Se vuelve a leer de Siesa: lo que se guarda es lo que tiene Siesa ahora, no lo que mandó el navegador
      const [p] = agruparPedidos(await consultarTodo<Record<string, unknown>>('API_v2_Ventas_Pedidos', condicion, 20, CONEXION))
      if (!p) { r(false, 'No se encontró en Siesa'); continue }
      if (p.estado === 9) { r(false, 'Está anulado en Siesa'); continue }
      if (p.fecha < desde) { r(false, `Es del ${p.fecha}: solo se agregan pedidos de los últimos ${DIAS_INSTITUCIONAL} días`); continue }
      if (!p.lineas.length) { r(false, 'El pedido no tiene líneas en Siesa'); continue }
      const previa = (await yaEnSistema([p.pedido])).get(p.pedido)
      if (previa) { r(false, `Ya está en el sistema (${previa.fuente === FUENTE_INSTITUCIONAL ? 'institucional' : `OC ${previa.numero_orden}`}${previa.ruta ? `, ruta ${previa.ruta}` : ''})`); continue }

      const fila = await guardarPedido(p, ruta, usuario)
      if (!fila?.id) { r(false, 'Ya está en el sistema'); continue }
      r(true, `Agregado a la ruta ${ruta}: ${p.razon_social} · ${fila.lineas} producto(s)`, fila.id)
    } catch (e) {
      r(false, `No se pudo consultar o guardar: ${e instanceof Error ? e.message : e}`)
    }
  }
  return resultados
}

// ── Automático ─────────────────────────────────────────────────────────────────────────────────
export const AGREGADO_AUTOMATICO = 'Automático (institucional)'

export interface ResultadoAutomatico { configurado: boolean; revisados: number; agregados: string[]; error?: string }

/** Clientes institucionales activos; [] si la tabla aún no existe (migración sin correr). */
export async function clientesInstitucionales(): Promise<ClienteInstitucional[]> {
  try {
    const filas = await sql`SELECT nit, nombre, ciudades, ruta, activo FROM cen_clientes_institucionales ORDER BY nombre`
    return filas.map(f => ({ nit: f.nit as string, nombre: f.nombre as string, ciudades: (f.ciudades as string[]) ?? [], ruta: f.ruta as string, activo: Boolean(f.activo) }))
  } catch { return [] }
}

/**
 * Trae solos los pedidos PVK de los últimos días de los clientes institucionales configurados cuyo punto de
 * envío está en una de sus ciudades, y los agrega a la ruta del cliente (la relación sale de la semana del
 * despacho, igual que los demás). No vuelve a traer los que ya están ni los que alguien quitó de la ruta.
 * Corre en cada sincronización (lib/cen/sincronizar.ts) y con el botón "Buscar ahora". Nunca lanza.
 */
export async function traerInstitucionalesAutomaticos(): Promise<ResultadoAutomatico> {
  if (!siesaConfigurado(CONEXION)) return { configurado: false, revisados: 0, agregados: [] }
  try {
    const clientes = (await clientesInstitucionales()).filter(c => c.activo && c.ciudades.length)
    const condicion = condicionAutomatica(clientes.map(c => c.nit), desdeInstitucional())
    if (!condicion) return { configurado: true, revisados: 0, agregados: [] }
    const pedidos = agruparPedidos(await consultarTodo<Record<string, unknown>>('API_v2_Ventas_Pedidos', condicion, 40, CONEXION))
      .map(p => ({ p, cliente: clienteDelPedido(p, clientes) }))
      .filter((x): x is { p: PedidoSiesaResumen; cliente: ClienteInstitucional } => Boolean(x.cliente) && x.p.estado !== 9 && x.p.lineas.length > 0)
    const existentes = await yaEnSistema(pedidos.map(x => x.p.pedido))
    const ignorados = new Set(await sql`SELECT pedido FROM cen_institucional_ignorados WHERE pedido = ANY(${pedidos.map(x => x.p.pedido)}::text[])`
      .then(r => r.map(f => f.pedido as string)).catch(() => [] as string[]))
    const agregados: string[] = []
    for (const { p, cliente } of pedidos) {
      if (existentes.has(p.pedido) || ignorados.has(p.pedido)) continue
      const r = await guardarPedido(p, cliente.ruta, AGREGADO_AUTOMATICO)
      if (r.id) agregados.push(p.pedido)
    }
    if (agregados.length) {
      await logAudit({
        usuarioId: null, usuarioNombre: AGREGADO_AUTOMATICO, accion: 'CEN_INSTITUCIONAL_AGREGADO',
        descripcion: `Agregó automáticamente ${agregados.length} pedido(s) institucional(es) de Siesa: ${agregados.join(', ')}`,
        datos: { pedidos: agregados, automatico: true },
      })
    }
    return { configurado: true, revisados: pedidos.length, agregados }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error('[cen] Institucionales automáticos:', error)
    return { configurado: true, revisados: 0, agregados: [], error }
  }
}
