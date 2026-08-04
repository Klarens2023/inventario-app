import type { Equipo, EquipoDetalle, HistReg, FiltrosEquipos, CamposNuevo, EquipoMantenimiento, RegistroMantenimiento } from '@/types/equipos'

export async function fetchEquipos(filtros: FiltrosEquipos): Promise<Equipo[]> {
  const params = new URLSearchParams()
  if (filtros.buscar) params.set('buscar', filtros.buscar)
  if (filtros.tipo)   params.set('tipo',   filtros.tipo)
  if (filtros.estado) params.set('estado', filtros.estado)
  const res = await fetch(`/api/sistemas/equipos?${params}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchEquipoDetalle(id: string): Promise<{ equipo: EquipoDetalle; mantenimientos: HistReg[]; incidencias: HistReg[]; cambios: HistReg[]; movimientos: HistReg[] }> {
  const res = await fetch(`/api/sistemas/equipos/${id}`)
  if (!res.ok) throw new Error('Equipo no encontrado')
  return res.json()
}

export async function crearEquipo(campos: CamposNuevo): Promise<{ id: string; error?: string }> {
  const res = await fetch('/api/sistemas/equipos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campos),
  })
  return res.json()
}

export async function actualizarEquipo(id: string, data: EquipoDetalle): Promise<{ error?: string }> {
  const res = await fetch(`/api/sistemas/equipos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function eliminarEquipo(id: string): Promise<void> {
  await fetch(`/api/sistemas/equipos/${id}`, { method: 'DELETE' })
}

export async function agregarHistorial(id: string, tipo: string, data: Record<string, string>): Promise<{ error?: string }> {
  const res = await fetch(`/api/sistemas/equipos/${id}/historial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, ...data }),
  })
  return res.json()
}

export async function fetchMantenimientos(buscar = ''): Promise<EquipoMantenimiento[]> {
  const params = new URLSearchParams()
  if (buscar) params.set('buscar', buscar)
  const res = await fetch(`/api/sistemas/mantenimientos?${params}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function registrarMantenimiento(data: RegistroMantenimiento): Promise<{ error?: string }> {
  const res = await fetch('/api/sistemas/mantenimientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}
