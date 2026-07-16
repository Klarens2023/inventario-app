import type { PuntoVenta, Registro } from '@/types/pvn-historial'

export async function getPuntosVenta(): Promise<PuntoVenta[]> {
  const res = await fetch('/api/pvn/puntos-venta')
  return res.json()
}

export async function getRegistros(params: { desde: string; hasta: string; pvFiltro: string }): Promise<Registro[]> {
  const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta })
  if (params.pvFiltro !== 'todos') qs.set('punto_venta_id', params.pvFiltro)
  const res  = await fetch(`/api/pvn/registros?${qs}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}
