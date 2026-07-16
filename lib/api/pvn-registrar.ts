import type { Producto } from '@/types/pvn-registrar'

export async function getProductos(): Promise<Producto[]> {
  const res = await fetch('/api/pvn/productos')
  return res.json()
}

export async function postRegistro(body: {
  fecha: string; turno: string; observaciones: string | null
  detalle: { producto_id: number; producto_nombre: string; cantidad: number }[]
}): Promise<{ ok: boolean; error?: string }> {
  const res  = await fetch('/api/pvn/registros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { ok: res.ok, error: data.error }
}
