import type { Usuario } from '@/types/usuarios'

export async function fetchUsuarios(): Promise<Usuario[]> {
  const res = await fetch('/api/usuarios')
  return res.json()
}

export async function crearUsuario(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return res.ok ? { ok: true } : { ok: false, error: data.error ?? 'Error al crear usuario' }
}

export async function editarUsuario(id: number, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return res.ok ? { ok: true } : { ok: false, error: data.error ?? 'Error al guardar' }
}

export async function toggleActivo(id: number, activo: boolean): Promise<boolean> {
  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  })
  return res.ok
}
