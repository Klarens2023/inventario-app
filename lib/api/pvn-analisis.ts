import type { Data, DetalleProd, PuntoVenta } from '@/types/pvn-analisis'

// Si la API responde error (401 de sesión revocada, 403, 500) devuelve [] en vez del
// objeto { error }: las pantallas hacen .map/.filter sobre esto y se caían (AUD-32).
export async function getPuntosVenta(): Promise<PuntoVenta[]> {
  const res = await fetch('/api/pvn/puntos-venta')
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
}

export async function getAnalisis(params: { desde: string; hasta: string; pvFiltro: string }): Promise<Data> {
  const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta })
  if (params.pvFiltro !== 'todos') qs.set('punto_venta_id', params.pvFiltro)
  const res = await fetch(`/api/pvn/analisis?${qs}`)
  if (!res.ok) throw new Error('No se pudo cargar el análisis')
  return res.json()
}

export async function getDetalleProducto(params: { productoId: number; desde: string; hasta: string; pvFiltro: string }): Promise<DetalleProd> {
  const qs = new URLSearchParams({ producto_id: String(params.productoId), desde: params.desde, hasta: params.hasta })
  if (params.pvFiltro !== 'todos') qs.set('punto_venta_id', params.pvFiltro)
  const res = await fetch(`/api/pvn/analisis/producto?${qs}`)
  if (!res.ok) throw new Error('No se pudo cargar el detalle del producto')
  return res.json()
}
