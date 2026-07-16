import type { Data, DetalleProd, PuntoVenta } from '@/types/pvn-analisis'

export async function getPuntosVenta(): Promise<PuntoVenta[]> {
  return fetch('/api/pvn/puntos-venta').then(r => r.json())
}

export async function getAnalisis(params: { desde: string; hasta: string; pvFiltro: string }): Promise<Data> {
  const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta })
  if (params.pvFiltro !== 'todos') qs.set('punto_venta_id', params.pvFiltro)
  const res = await fetch(`/api/pvn/analisis?${qs}`)
  return res.json()
}

export async function getDetalleProducto(params: { productoId: number; desde: string; hasta: string; pvFiltro: string }): Promise<DetalleProd> {
  const qs = new URLSearchParams({ producto_id: String(params.productoId), desde: params.desde, hasta: params.hasta })
  if (params.pvFiltro !== 'todos') qs.set('punto_venta_id', params.pvFiltro)
  const res = await fetch(`/api/pvn/analisis/producto?${qs}`)
  return res.json()
}
