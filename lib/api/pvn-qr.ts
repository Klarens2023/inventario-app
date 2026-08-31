import type { Turno, TurnoResp, TurnoHist, PuntoVenta, Pago } from '@/types/pvn-qr'

export async function getTurno(): Promise<TurnoResp> {
  const r = await fetch('/api/qr/turno?pendiente=true')
  return r.json()
}

export async function getTurnosHistorial(): Promise<TurnoHist[]> {
  const data = await fetch('/api/qr/turno?historial=true').then(r => r.json())
  return Array.isArray(data) ? data : []
}

export async function abrirTurno(puntoVentaId: string): Promise<{ ok: true; turno: Turno } | { ok: false; error: string }> {
  const res = await fetch('/api/qr/turno', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'abrir', punto_venta_id: puntoVentaId }),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error ?? 'Error al abrir turno' }
  return { ok: true, turno: data }
}

export async function cerrarTurno(
  turnoId?: number,
  datafono?: { foto: File; numeroRecogida: string }
): Promise<{ ok: true; total_pagos: number; total_valor: number } | { ok: false; error: string }> {
  let res: Response
  if (datafono) {
    const form = new FormData()
    form.append('accion', 'cerrar')
    if (turnoId) form.append('turno_id', String(turnoId))
    form.append('numero_recogida', datafono.numeroRecogida)
    form.append('foto_datafono', datafono.foto)
    res = await fetch('/api/qr/turno', { method: 'POST', body: form })
  } else {
    const body: Record<string, unknown> = { accion: 'cerrar' }
    if (turnoId) body.turno_id = turnoId
    res = await fetch('/api/qr/turno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error ?? 'Error al cerrar turno' }
  return { ok: true, total_pagos: data.total_pagos, total_valor: data.total_valor }
}

export async function getPuntosVentaPrincipales(): Promise<PuntoVenta[]> {
  const data = await fetch('/api/pvn/puntos-venta').then(r => r.json())
  return Array.isArray(data) ? data.filter((p: PuntoVenta) => p.activo && p.tipo === 'principal') : []
}

export async function getPagosHoy(turnoId?: number | null): Promise<Pago[]> {
  const qs = turnoId ? `?turno_id=${turnoId}` : ''
  const data = await fetch(`/api/qr/pagos${qs}`).then(r => r.json())
  return Array.isArray(data) ? data : []
}

export async function postPago(foto: File, valor: number, turnoId?: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData()
  form.append('foto', foto)
  form.append('valor', String(valor))
  // Carga tardía de QR de un turno pendiente (de un día anterior) antes de
  // cerrarlo — sin esto, el backend siempre asocia el pago al turno de hoy.
  if (turnoId) form.append('turno_id', String(turnoId))
  const res = await fetch('/api/qr/pagos', { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error ?? 'Error al registrar' }
  return { ok: true }
}

export async function putPago(id: number, valor: number): Promise<boolean> {
  const res = await fetch(`/api/qr/pagos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor }),
  })
  return res.ok
}

export async function deletePago(id: number): Promise<boolean> {
  const res = await fetch(`/api/qr/pagos/${id}`, { method: 'DELETE' })
  return res.ok
}
