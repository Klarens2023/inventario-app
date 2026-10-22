import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import jwt from 'jsonwebtoken'
import { authOptions } from './auth'
import { cargarEstadoUsuario } from './estadoUsuario'

/** Usuario autenticado tal como lo ven las rutas API (web o app móvil). */
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

/**
 * Autenticación compartida de las rutas API: sesión web (cookie de NextAuth)
 * o JWT de la app móvil (`Authorization: Bearer <token>`, emitido por
 * /api/auth/mobile/login).
 *
 * Controles de seguridad:
 * - La sesión web ya llega revalidada contra la BD (callbacks.jwt en lib/auth.ts).
 * - El token móvil dura 30 días, así que aquí también se revalida contra la BD:
 *   rol, área, punto de venta, módulos y "debe cambiar contraseña" salen de la
 *   BD, no del token; si el usuario fue desactivado se rechaza.
 * - El token móvil solo se acepta firmado con HS256 (algoritmo fijado).
 *
 * @returns el usuario, o `null` si no hay credenciales válidas, la sesión fue
 *          revocada o tiene un cambio de contraseña pendiente (salvo que la ruta
 *          lo permita con `permitirCambioPassword`).
 */
export async function getAuthUser(req: NextRequest, opciones: OpcionesAuth = {}): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const u = session.user
    if (u.revocado) return null
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
    let payload: { id?: string | number; name?: string }
    try {
      payload = jwt.verify(token, process.env.NEXTAUTH_SECRET as string, { algorithms: ['HS256'] }) as typeof payload
    } catch {
      return null
    }
    if (payload.id === undefined) return null

    // Sin try/catch a propósito: si la BD falla, la ruta responde 500 en vez de
    // aceptar un token de 30 días sin poder comprobar que el usuario sigue activo.
    const estado = await cargarEstadoUsuario(payload.id)
    if (!estado) return null
    if (estado.debe_cambiar_password && !opciones.permitirCambioPassword) return null
    return {
      id: String(payload.id),
      name: payload.name ?? '',
      rol: estado.rol,
      area: estado.area,
      punto_venta_id: estado.punto_venta_id,
      modulos: estado.modulos,
      debeCambiarPassword: estado.debe_cambiar_password,
    }
  }

  return null
}
