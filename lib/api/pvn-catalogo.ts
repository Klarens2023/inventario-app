import type { Comp, Producto } from '@/types/pvn-catalogo'

export async function getProductos(): Promise<Producto[]> {
  const res = await fetch('/api/pvn/productos?all=1')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function guardarProducto(
  body: { nombre: string; activo: boolean; componentes: Comp[] },
  editId?: number
): Promise<{ ok: boolean; error?: string }> {
  const url = editId ? `/api/pvn/productos/${editId}` : '/api/pvn/productos'
  const res  = await fetch(url, {
    method: editId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { ok: res.ok, error: data.error }
}

export async function toggleActivoProducto(id: number, activo: boolean) {
  return fetch(`/api/pvn/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  })
}
