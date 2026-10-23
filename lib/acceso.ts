// ════════════════════════════════════════════════════════════════════════════
// Control de acceso único para todas las rutas API.
//
// Antes cada ruta repetía su propio bloque getServerSession + tieneModulo, con
// variaciones: unas revisaban el cambio de contraseña pendiente y otras no
// (AUD-02), unas aceptaban el token de la app móvil y otras no. Aquí queda una
// sola regla declarativa por ruta; el detalle de cómo se valida la sesión vive
// en getAuthUser (lib/api-auth.ts), que además revalida al usuario en la BD.
//
// Uso típico en una ruta:
//   const acceso = await exigirAcceso(req, { modulos: ['acumulados'] })
//   if (!acceso.ok) return acceso.respuesta          // 401 o 403 ya armado
//   const { user } = acceso                          // usuario vigente
// ════════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, type AuthUser } from './api-auth'
import { tieneModulo, type Modulo } from './permissions'

/** Qué se exige para entrar a una ruta. Sin `modulos` ni `roles`: basta con estar autenticado. */
export type ReglaAcceso = {
  /**
   * Módulos que habilitan la ruta: basta con tener UNO. El admin siempre los
   * tiene todos (ver tieneModulo).
   */
  modulos?: Modulo[]
  /**
   * Roles que entran por sí mismos, tengan o no módulos (p. ej. ['pvn','pvv']
   * para las pantallas de los puntos de venta). Ojo: el admin NO entra por aquí
   * salvo que se incluya 'admin' o la ruta pida un módulo.
   */
  roles?: string[]
  /**
   * true: también acepta el token Bearer de la app móvil. Por defecto solo la
   * cookie de sesión web, para que un token de 30 días guardado en un teléfono
   * no abra las rutas de administración.
   */
  movil?: boolean
  /**
   * true: deja pasar a un usuario con cambio de contraseña pendiente (solo lo
   * usa /api/cambiar-password).
   */
  permitirCambioPassword?: boolean
}

/** Resultado: o el usuario autorizado, o la respuesta de error lista para devolver. */
export type Acceso = { ok: true; user: AuthUser } | { ok: false; respuesta: NextResponse }

const NO_AUTORIZADO = () => NextResponse.json({ error: 'No autorizado' }, { status: 401 })
const RESTRINGIDO = () => NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

/**
 * Autentica y autoriza la petición según la regla de la ruta.
 *
 * - 401 si no hay sesión válida (o fue revocada, o tiene cambio de contraseña
 *   pendiente y la ruta no lo permite, o es un token móvil en una ruta solo web).
 * - 403 si hay sesión pero el rol/módulos no alcanzan.
 */
export async function exigirAcceso(req: NextRequest, regla: ReglaAcceso = {}): Promise<Acceso> {
  // getAuthUser revalida contra la BD (usuario activo, rol y módulos vigentes)
  const user = await getAuthUser(req, {
    soloSesion: !regla.movil,
    permitirCambioPassword: regla.permitirCambioPassword,
  })
  if (!user) return { ok: false, respuesta: NO_AUTORIZADO() }

  const { modulos, roles } = regla
  // Sin restricciones de rol ni módulo: cualquier usuario autenticado
  if (!modulos?.length && !roles?.length) return { ok: true, user }

  // Entra si su rol está en la lista explícita…
  if (roles?.includes(user.rol)) return { ok: true, user }
  // …o si tiene alguno de los módulos (el admin los tiene todos)
  if (modulos?.some(m => tieneModulo(user.rol, user.modulos, m))) return { ok: true, user }

  return { ok: false, respuesta: RESTRINGIDO() }
}
