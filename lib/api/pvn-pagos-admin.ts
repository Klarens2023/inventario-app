import type { PagoAdmin, PuntoVenta, Usuario, TurnoActivo } from '@/types/pvn-pagos-admin'

export async function getPagos(params: { desde: string; hasta: string; puntoVentaId?: string; usuarioId?: string }): Promise<PagoAdmin[]> {
  const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta })
  if (params.puntoVentaId && params.puntoVentaId !== 'todos') qs.set('punto_venta_id', params.puntoVentaId)
  if (params.usuarioId && params.usuarioId !== 'todos') qs.set('usuario_id', params.usuarioId)
  const data = await fetch(`/api/qr/pagos?${qs}`).then(r => r.json())
  return Array.isArray(data) ? data : []
}

export async function getPuntosVenta(): Promise<PuntoVenta[]> {
  return fetch('/api/pvn/puntos-venta').then(r => r.json())
}

export async function getUsuariosPvnPvv(): Promise<Usuario[]> {
  const data = await fetch('/api/usuarios').then(r => r.json())
  return Array.isArray(data) ? data.filter((u: Usuario) => ['pvn', 'pvv'].includes(u.rol)) : []
}

export async function getTurnosActivos(): Promise<TurnoActivo[]> {
  const data = await fetch('/api/qr/turno/activos').then(r => r.json())
  return Array.isArray(data) ? data : []
}

export async function cerrarTurnoActivo(turnoId: number): Promise<boolean> {
  const res = await fetch('/api/qr/turno/activos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turno_id: turnoId }),
  })
  return res.ok
}

export async function putPagoAdmin(id: number, cambios: { valor?: number; punto_venta_id?: string }): Promise<boolean> {
  const res = await fetch(`/api/qr/pagos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cambios),
  })
  return res.ok
}

export async function deletePagoAdmin(id: number): Promise<boolean> {
  const res = await fetch(`/api/qr/pagos/${id}`, { method: 'DELETE' })
  return res.ok
}
