import type { PuntoVenta, Registro } from '@/types/pvn-historial'

// Si la API responde error (401 de sesión revocada, 403, 500) devuelve [] en vez del
// objeto { error }: las pantallas hacen .map/.filter sobre esto y se caían (AUD-32).
export async function getPuntosVenta(): Promise<PuntoVenta[]> {
  const res = await fetch('/api/pvn/puntos-venta')
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
}

export async function getRegistros(params: { desde: string; hasta: string; pvFiltro: string }): Promise<Registro[]> {
  const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta })
  if (params.pvFiltro !== 'todos') qs.set('punto_venta_id', params.pvFiltro)
  const res  = await fetch(`/api/pvn/registros?${qs}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
