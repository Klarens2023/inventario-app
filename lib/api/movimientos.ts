import type { MovimientoResumen, MovimientoDetalle, FiltrosMovimientos } from '@/types/movimientos'

export async function fetchMovimientos(filtros: FiltrosMovimientos): Promise<MovimientoResumen[]> {
  const q = new URLSearchParams()
  if (filtros.buscar) q.set('buscar', filtros.buscar)
  if (filtros.estado) q.set('estado', filtros.estado)
  if (filtros.desde)  q.set('desde',  filtros.desde)
  if (filtros.hasta)  q.set('hasta',  filtros.hasta)
  const res = await fetch(`/api/sistemas/movimientos?${q}`)
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
}

export async function fetchMovimientoDetalle(id: string): Promise<MovimientoDetalle> {
  const res = await fetch(`/api/sistemas/movimientos/${id}`)
  return res.json()
}

export async function crearMovimiento(body: Record<string, unknown>): Promise<{ id: string; error?: string }> {
  const res = await fetch('/api/sistemas/movimientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function actualizarEstado(id: string, estado: string): Promise<boolean> {
  const res = await fetch(`/api/sistemas/movimientos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  })
  return res.ok
}
