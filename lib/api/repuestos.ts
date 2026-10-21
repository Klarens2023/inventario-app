import type {
  Articulo, MovimientoArticulo, FiltrosArticulos, FiltrosKardex, EquipoOpcion,
  Asignacion, FiltrosAsignaciones, AsignadoPrevio, FiltrosConsumo, ReporteConsumo,
  AsignacionImpresion, MovimientoImpresion,
} from '@/types/repuestos'

export async function fetchArticulos(f: FiltrosArticulos): Promise<Articulo[]> {
  const q = new URLSearchParams()
  if (f.buscar)    q.set('buscar', f.buscar)
  if (f.categoria) q.set('categoria', f.categoria)
  if (f.stock)     q.set('stock', f.stock)
  if (f.inactivos) q.set('inactivos', '1')
  const res = await fetch(`/api/sistemas/repuestos?${q}`)
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
}

export async function crearArticulo(body: Record<string, unknown>): Promise<{ codigo?: string; error?: string }> {
  const res = await fetch('/api/sistemas/repuestos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return res.json()
}

export async function actualizarArticulo(codigo: string, body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`/api/sistemas/repuestos/${codigo}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return res.json()
}

export async function fetchKardex(f: FiltrosKardex, articulo = ''): Promise<MovimientoArticulo[]> {
  const q = new URLSearchParams()
  if (articulo) q.set('articulo', articulo)
  if (f.buscar) q.set('buscar', f.buscar)
  if (f.tipo)   q.set('tipo', f.tipo)
  if (f.desde)  q.set('desde', f.desde)
  if (f.hasta)  q.set('hasta', f.hasta)
  const res = await fetch(`/api/sistemas/repuestos/movimientos?${q}`)
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
}

export async function registrarMovimiento(body: Record<string, unknown>): Promise<{
  id?: number; stock_resultante?: number; asignacion_id?: number; error?: string
  requiere_decision?: boolean; vigentes?: AsignadoPrevio[]
}> {
  const res = await fetch('/api/sistemas/repuestos/movimientos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return res.json()
}

export async function buscarEquipos(buscar: string): Promise<EquipoOpcion[]> {
  const res = await fetch(`/api/sistemas/repuestos/equipos?buscar=${encodeURIComponent(buscar)}`)
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
}

export async function fetchAsignaciones(f: Partial<FiltrosAsignaciones> & { equipo_id?: string }): Promise<Asignacion[]> {
  const q = new URLSearchParams()
  if (f.buscar)    q.set('buscar', f.buscar)
  if (f.estado)    q.set('estado', f.estado)
  if (f.vencidos)  q.set('vencidos', '1')
  if (f.equipo_id) q.set('equipo_id', f.equipo_id)
  const res = await fetch(`/api/sistemas/repuestos/asignaciones?${q}`)
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
}

export async function retirarAsignacion(id: number, body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`/api/sistemas/repuestos/asignaciones/${id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return res.json()
}

export async function fetchConsumo(f: FiltrosConsumo, detalle = false): Promise<ReporteConsumo | { error: string }> {
  const q = new URLSearchParams({ desde: f.desde, hasta: f.hasta })
  if (detalle)     q.set('detalle', '1')
  if (f.categoria) q.set('categoria', f.categoria)
  if (f.equipo_id) q.set('equipo_id', f.equipo_id)
  if (f.area)      q.set('area', f.area)
  const res = await fetch(`/api/sistemas/repuestos/consumo?${q}`)
  return res.json()
}

export async function fetchAsignacionImpresion(id: number): Promise<AsignacionImpresion | null> {
  const res = await fetch(`/api/sistemas/repuestos/asignaciones/${id}`)
  return res.ok ? res.json() : null
}

export async function fetchMovimientoImpresion(id: number): Promise<MovimientoImpresion | null> {
  const res = await fetch(`/api/sistemas/repuestos/movimientos/${id}`)
  return res.ok ? res.json() : null
}

// null = todo bien; texto = el módulo no puede operar (p. ej. falta correr la migración)
export async function verificarModulo(): Promise<string | null> {
  const res = await fetch('/api/sistemas/repuestos?buscar=__verificar__')
  if (res.ok) return null
  const data = await res.json().catch(() => ({}))
  return data.falta_migracion ? data.error : null
}
