// Cálculos de los reportes de órdenes EDI (/logistica/ordenes-cen/reportes). Sin dependencias de
// servidor: la API entrega las órdenes y sus líneas del periodo y aquí se arman los reportes, para
// poder probarlos (tests/reportes-cen.test.ts) y usarlos en el navegador. Sin imports, como el resto de la
// lógica probada del módulo: el código de relación (lib/cen/relacion.ts) se recibe como parámetro.

export type OrdenReporte = {
  id: number
  numero_orden: string
  fuente: string
  ean_comprador: string
  cadena: string
  fecha_orden: string | null
  fecha_entrega: string | null
  fecha_entrega_max: string | null
  ean_entrega: string
  nit: string | null
  sucursal: string | null
  razon_social: string | null
  ciudad: string | null
  ruta: string | null
  estado: string
  total_unidades: number
  valor_total: number
  peso_kg: number | null
  locales: number
  siesa_consecutivo: string | null
  enviado_at: string | null
  enviado_por: string | null
  descartada_at: string | null
  descartada_por: string | null
  motivo_descarte: string | null
  recibida_at: string | null // cuando el archivo quedó en el SFTP
  leida_at: string | null // cuando la app lo leyó
}

export type LineaReporte = {
  orden_id: number
  nro_linea: number
  ean_item: string
  f120_id: number | null
  descripcion: string
  cod_comprador: string | null
  cantidad: number
  precio: number
  unidad: string | null // 'KG' = la cadena pidió en kilos
  peso_unitario: number | null // kg por unidad según el maestro (de la cadena o general)
  und_caja: number | null
}

// ── Fechas ────────────────────────────────────────────────────────────────

/** Días entre dos fechas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000)
}

/** Semana ISO "AAAA-Sss" de una fecha AAAA-MM-DD (el año es el de la semana, no el de la fecha). */
export function semanaIso(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00Z')
  const jueves = new Date(d); jueves.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const anio = jueves.getUTCFullYear()
  const semana = Math.ceil(((jueves.getTime() - Date.UTC(anio, 0, 1)) / 86400000 + 1) / 7)
  return `${anio}-S${String(semana).padStart(2, '0')}`
}

// ── Cumplimiento ──────────────────────────────────────────────────────────

export type Cumplimiento =
  | 'cumplida_a_tiempo' // pedido creado en Siesa a más tardar el día de entrega
  | 'cumplida_tarde' // pedido creado después del día de entrega
  | 'vencida' // sin pedido y la fecha de entrega ya pasó
  | 'por_vencer' // sin pedido y se entrega hoy o mañana
  | 'a_tiempo' // sin pedido, con margen
  | 'descartada'

export const CUMPLIMIENTO: Record<Cumplimiento, { label: string; color: string; bg: string }> = {
  cumplida_a_tiempo: { label: 'Cumplida a tiempo', color: '#047857', bg: '#D1FAE5' },
  cumplida_tarde: { label: 'Cumplida tarde', color: '#B45309', bg: '#FEF3C7' },
  vencida: { label: 'Vencida sin pedido', color: '#B91C1C', bg: '#FEE2E2' },
  por_vencer: { label: 'Por vencer', color: '#C2410C', bg: '#FFEDD5' },
  a_tiempo: { label: 'Abierta a tiempo', color: '#0047BA', bg: '#E0ECFF' },
  descartada: { label: 'Descartada', color: '#475569', bg: '#E2E8F0' },
}

/** Fecha límite para crear el pedido: el primer día de entrega que pide la cadena. */
export function fechaLimite(o: Pick<OrdenReporte, 'fecha_entrega' | 'fecha_entrega_max'>): string | null {
  return o.fecha_entrega ?? o.fecha_entrega_max
}

export function cumplimiento(o: Pick<OrdenReporte, 'estado' | 'fecha_entrega' | 'fecha_entrega_max' | 'enviado_at'>, hoy: string): Cumplimiento {
  if (o.estado === 'descartada') return 'descartada'
  const limite = fechaLimite(o)
  if (o.estado === 'enviado') {
    const envio = o.enviado_at?.slice(0, 10)
    return !limite || !envio || envio <= limite ? 'cumplida_a_tiempo' : 'cumplida_tarde'
  }
  if (!limite) return 'a_tiempo'
  const dias = diasEntre(hoy, limite)
  if (dias < 0) return 'vencida'
  if (dias <= 1) return 'por_vencer'
  return 'a_tiempo'
}

// ── Líneas ────────────────────────────────────────────────────────────────

/** Peso de una línea: si la cadena pidió en kilos ya es el peso; si no, unidades × peso del maestro. */
export function pesoLinea(l: Pick<LineaReporte, 'cantidad' | 'unidad' | 'peso_unitario'>): number | null {
  if (l.unidad === 'KG') return l.cantidad
  return l.peso_unitario === null ? null : l.cantidad * l.peso_unitario
}

/** Cajas aproximadas de una línea (unidades ÷ unidades por caja), con un decimal. */
export function cajasLinea(l: Pick<LineaReporte, 'cantidad' | 'unidad' | 'und_caja'>): number | null {
  if (l.unidad === 'KG' || !l.und_caja) return null
  return Math.round((l.cantidad / l.und_caja) * 10) / 10
}

// ── Agrupaciones ──────────────────────────────────────────────────────────

export type Totales = { ordenes: number; unidades: number; valor: number; peso: number; pesoCompleto: boolean }

function vacio(): Totales & { _ids: Set<number> } { return { ordenes: 0, unidades: 0, valor: 0, peso: 0, pesoCompleto: true, _ids: new Set() } }
function cerrar<T extends { _ids: Set<number> }>(x: T): Omit<T, '_ids'> & { ordenes: number } {
  const { _ids, ...resto } = x
  return { ...resto, ordenes: _ids.size }
}

/** Totales por clave a partir de las líneas (cuenta órdenes distintas). */
export function agruparLineas<K extends string>(lineas: LineaReporte[], clave: (l: LineaReporte) => K): Map<K, Totales> {
  const m = new Map<K, Totales & { _ids: Set<number> }>()
  for (const l of lineas) {
    const k = clave(l), t = m.get(k) ?? vacio()
    t._ids.add(l.orden_id); t.unidades += l.cantidad; t.valor += l.cantidad * l.precio
    const p = pesoLinea(l); if (p === null) t.pesoCompleto = false; else t.peso += p
    m.set(k, t)
  }
  return new Map(Array.from(m, ([k, t]) => [k, cerrar(t) as Totales]))
}

/** Totales por clave a partir de las órdenes. */
export function agruparOrdenes<K extends string>(ordenes: OrdenReporte[], clave: (o: OrdenReporte) => K): Map<K, Totales & { puntos: number }> {
  const m = new Map<K, Totales & { _ids: Set<number>; _puntos: Set<string> }>()
  for (const o of ordenes) {
    const k = clave(o), t = m.get(k) ?? { ...vacio(), _puntos: new Set<string>() }
    t._ids.add(o.id); t._puntos.add(o.ean_entrega); t.unidades += o.total_unidades; t.valor += o.valor_total
    if (o.peso_kg === null) t.pesoCompleto = false; else t.peso += o.peso_kg
    m.set(k, t)
  }
  return new Map(Array.from(m, ([k, t]) => { const { _ids, _puntos, ...r } = t; return [k, { ...r, ordenes: _ids.size, puntos: _puntos.size }] }))
}

// ── Reportes ──────────────────────────────────────────────────────────────

export type FilaNecesidad = { ean: string; f120_id: number | null; descripcion: string; porDia: Record<string, { unidades: number; peso: number | null }>; total: Totales }

/** Necesidad por producto y día de entrega (para planear producción y cargue). */
export function necesidadPorProducto(ordenes: OrdenReporte[], lineas: LineaReporte[]): { dias: string[]; filas: FilaNecesidad[] } {
  const ordenPorId = new Map(ordenes.map(o => [o.id, o]))
  const lns = lineas.filter(l => ordenPorId.get(l.orden_id)?.estado !== 'descartada')
  const dias = Array.from(new Set(lns.map(l => ordenPorId.get(l.orden_id)?.fecha_entrega ?? 'sin fecha'))).sort()
  const totales = agruparLineas(lns, l => l.ean_item)
  const filas = new Map<string, FilaNecesidad>()
  for (const l of lns) {
    const dia = ordenPorId.get(l.orden_id)?.fecha_entrega ?? 'sin fecha'
    const f = filas.get(l.ean_item) ?? { ean: l.ean_item, f120_id: l.f120_id, descripcion: l.descripcion, porDia: {}, total: totales.get(l.ean_item)! }
    const d = f.porDia[dia] ?? { unidades: 0, peso: 0 }
    d.unidades += l.cantidad
    const p = pesoLinea(l); d.peso = p === null || d.peso === null ? null : d.peso + p
    f.porDia[dia] = d; filas.set(l.ean_item, f)
  }
  return { dias, filas: Array.from(filas.values()).sort((a, b) => b.total.peso - a.total.peso || b.total.unidades - a.total.unidades) }
}

export type FilaRelacion = {
  relacion: string; ruta: string; numero_orden: string; cadena: string; razon_social: string; nit: string; sucursal: string
  fecha_entrega: string | null; fecha_entrega_max: string | null; ciudad: string; ean_entrega: string
  f120_id: number | null; ean_item: string; descripcion: string; cantidad: number; valor: number; peso: number | null; cajas: number | null
  pedido: string; estado: string
}

/** Líneas de la relación de despacho (como las hojas por ruta del libro de logística). */
export function lineasRelacion(
  ordenes: OrdenReporte[], lineas: LineaReporte[],
  codigoRelacion: (ruta: string | null, fechaEntrega: string | null) => string | null,
): FilaRelacion[] {
  const ordenPorId = new Map(ordenes.map(o => [o.id, o]))
  const filas: FilaRelacion[] = []
  for (const l of lineas) {
    const o = ordenPorId.get(l.orden_id); if (!o || o.estado === 'descartada') continue
    filas.push({
      relacion: codigoRelacion(o.ruta, o.fecha_entrega) ?? 'Sin ruta', ruta: o.ruta ?? 'Sin ruta', numero_orden: o.numero_orden, cadena: o.cadena,
      razon_social: o.razon_social ?? `Punto sin sucursal (EAN ${o.ean_entrega})`, nit: o.nit ?? '', sucursal: o.sucursal ?? '',
      fecha_entrega: o.fecha_entrega, fecha_entrega_max: o.fecha_entrega_max, ciudad: o.ciudad ?? '', ean_entrega: o.ean_entrega,
      f120_id: l.f120_id, ean_item: l.ean_item, descripcion: l.descripcion, cantidad: l.cantidad, valor: l.cantidad * l.precio,
      peso: pesoLinea(l), cajas: cajasLinea(l), pedido: o.siesa_consecutivo ?? '', estado: o.estado,
    })
  }
  return filas.sort((a, b) => a.relacion.localeCompare(b.relacion) || a.razon_social.localeCompare(b.razon_social) || a.numero_orden.localeCompare(b.numero_orden))
}

export type FilaTiempo = { cadena: string; ordenes: number; anticipacionProm: number | null; anticipacionMin: number | null; anticipacionMax: number | null; lecturaHorasProm: number | null; lecturaHorasMax: number | null; envioDiasProm: number | null; enviadas: number; aTiempo: number }

const horasEntre = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 3600000
const prom = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null

/** Tiempos por cadena: anticipación de la OC, demora en leer el archivo y en crear el pedido. */
export function tiemposPorCadena(ordenes: OrdenReporte[], hoy: string): FilaTiempo[] {
  const grupos = new Map<string, OrdenReporte[]>()
  for (const o of ordenes) grupos.set(o.cadena, [...(grupos.get(o.cadena) ?? []), o])
  return Array.from(grupos, ([cadena, os]) => {
    const antic = os.filter(o => o.fecha_orden && fechaLimite(o)).map(o => diasEntre(o.fecha_orden!, fechaLimite(o)!))
    const lectura = os.filter(o => o.recibida_at && o.leida_at).map(o => horasEntre(o.recibida_at!, o.leida_at!)).filter(h => h >= 0)
    const enviadas = os.filter(o => o.estado === 'enviado')
    const envio = enviadas.filter(o => o.enviado_at && o.leida_at).map(o => horasEntre(o.leida_at!, o.enviado_at!) / 24)
    return {
      cadena, ordenes: os.length,
      anticipacionProm: prom(antic), anticipacionMin: antic.length ? Math.min(...antic) : null, anticipacionMax: antic.length ? Math.max(...antic) : null,
      lecturaHorasProm: prom(lectura), lecturaHorasMax: lectura.length ? Math.max(...lectura) : null,
      envioDiasProm: prom(envio), enviadas: enviadas.length, aTiempo: enviadas.filter(o => cumplimiento(o, hoy) === 'cumplida_a_tiempo').length,
    }
  }).sort((a, b) => b.ordenes - a.ordenes)
}
