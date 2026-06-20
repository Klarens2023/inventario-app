import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'
import { authOptions } from './auth'

export type AuthUser = {
  id: string
  name: string
  rol: string
  area: string
  punto_venta_id: number | null
  modulos: string[]
}

// Autenticación compartida: sesión web (NextAuth cookie) o JWT móvil (Bearer token)
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const u = session.user
    return {
      id: u.id,
      name: u.name,
      rol: u.rol,
      area: u.area,
      punto_venta_id: u.punto_venta_id ?? null,
      modulos: u.modulos ?? [],
    }
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET as string) as AuthUser
      return {
        id: String(payload.id),
        name: payload.name,
        rol: payload.rol,
        area: payload.area,
        punto_venta_id: payload.punto_venta_id ?? null,
        modulos: [],
      }
    } catch {
      return null
    }
  }

  return null
}
