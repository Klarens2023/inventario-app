import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, type AuthUser } from '@/lib/api-auth'
import { tieneModulo } from '@/lib/permissions'

// Devuelve el usuario si tiene el módulo de órdenes EDI, o la respuesta de error lista para retornar.
export async function verificarAcceso(req: NextRequest): Promise<{ user: AuthUser } | { respuesta: NextResponse }> {
  const user = await getAuthUser(req)
  if (!user) return { respuesta: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  if (!tieneModulo(user.rol, user.modulos, 'ordenes_cen')) {
    return { respuesta: NextResponse.json({ error: 'Acceso restringido' }, { status: 403 }) }
  }
  return { user }
}
