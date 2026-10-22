import type { Usuario } from '@/types/usuarios'

// [] si la API responde error (p. ej. 401 cuando la sesión quedó con cambio de
// contraseña pendiente): antes se guardaba el objeto { error } y la pantalla
// fallaba con "usuarios.filter is not a function".
export async function fetchUsuarios(): Promise<Usuario[]> {
  const res = await fetch('/api/usuarios')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// passwordTemporal: contraseña inicial generada por el servidor; llega solo en esta respuesta.
export async function crearUsuario(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; passwordTemporal?: string }> {
  const res = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return res.ok ? { ok: true, passwordTemporal: data.password_temporal } : { ok: false, error: data.error ?? 'Error al crear usuario' }
}

// passwordTemporal: solo cuando el body pidió resetPassword.
export async function editarUsuario(id: number, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; passwordTemporal?: string }> {
  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return res.ok ? { ok: true, passwordTemporal: data.password_temporal } : { ok: false, error: data.error ?? 'Error al guardar' }
}

export async function toggleActivo(id: number, activo: boolean): Promise<boolean> {
  const res = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  })
  return res.ok
}
