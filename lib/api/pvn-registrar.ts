import type { Producto } from '@/types/pvn-registrar'

// Si la API responde error (401 de sesión revocada, 403, 500) devuelve [] en vez del
// objeto { error }: las pantallas hacen .map/.filter sobre esto y se caían (AUD-32).
export async function getProductos(): Promise<Producto[]> {
  const res = await fetch('/api/pvn/productos')
  const data = res.ok ? await res.json() : []
  return Array.isArray(data) ? data : []
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
