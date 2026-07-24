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
  debeCambiarPassword: boolean
}

type OpcionesAuth = {
  // Solo /api/cambiar-password debe poder usarse con la contraseña genérica
  // pendiente de cambiar; cualquier otra ruta queda bloqueada hasta que la
  // cambie, para que no se pueda usar la API completa saltándose esa pantalla.
  permitirCambioPassword?: boolean
}

// Autenticación compartida: sesión web (NextAuth cookie) o JWT móvil (Bearer token)
export async function getAuthUser(req: NextRequest, opciones: OpcionesAuth = {}): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const u = session.user
    if (u.debe_cambiar_password && !opciones.permitirCambioPassword) return null
    return {
      id: u.id,
      name: u.name,
      rol: u.rol,
      area: u.area,
      punto_venta_id: u.punto_venta_id ?? null,
      modulos: u.modulos ?? [],
      debeCambiarPassword: u.debe_cambiar_password ?? false,
    }
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET as string) as AuthUser & { debe_cambiar_password?: boolean }
      if (payload.debe_cambiar_password && !opciones.permitirCambioPassword) return null
      return {
        id: String(payload.id),
        name: payload.name,
        rol: payload.rol,
        area: payload.area,
        punto_venta_id: payload.punto_venta_id ?? null,
        modulos: [],
        debeCambiarPassword: payload.debe_cambiar_password ?? false,
      }
    } catch {
      return null
    }
  }

  return null
}
