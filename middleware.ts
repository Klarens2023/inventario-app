import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { tieneModulo, type Modulo } from '@/lib/permissions'

// ════════════════════════════════════════════════════════════════════════════
// Middleware de las PÁGINAS. Hace dos cosas:
//
//  1. Content-Security-Policy con nonce: en cada petición se genera un valor
//     aleatorio y solo los <script> que lo llevan pueden ejecutarse. Next.js lo
//     lee del encabezado de la petición y se lo pone a sus propios scripts. Así
//     un script inyectado (XSS) no corre aunque llegue al HTML, cosa que la CSP
//     anterior con 'unsafe-inline' no impedía.
//
//  2. Control de acceso a pantallas por rol/módulo. NO es la barrera de los
//     datos: cada ruta /api valida por su cuenta con exigirAcceso (lib/acceso.ts).
//     Esto solo evita mostrar pantallas a quien no tiene permiso.
// ════════════════════════════════════════════════════════════════════════════

/** Prefijo de página → módulo que la habilita (el admin pasa siempre). */
const PATH_MODULO: Array<[string, Modulo]> = [
  ['/cargar', 'cargar'],
  ['/consulta', 'consulta'],
  ['/acumulados', 'acumulados'],
  ['/pvn/historial', 'pvn_historial'],
  ['/pvn/analisis', 'pvn_analisis'],
  ['/pvn/catalogo', 'pvn_catalogo'],
  ['/pvn/pagos-qr', 'pvn_pagos_qr'],
  ['/sistemas/equipos', 'equipos'],
  ['/sistemas/mantenimientos', 'equipos'],
  ['/sistemas/movimientos', 'movimientos_tic'],
  ['/sistemas/repuestos', 'repuestos_tic'],
  ['/planos', 'planos'],
  ['/logistica/ordenes-cen', 'ordenes_cen'],
  ['/contabilidad/conciliacion-facturas', 'conciliacion_facturas'],
]

/** Páginas que exigen sesión. El resto (login, inicio) es público. */
const PROTEGIDAS = [
  '/dashboard', '/cargar', '/consulta', '/acumulados', '/auditoria', '/admin',
  '/sistemas', '/pvn', '/planos', '/logistica', '/contabilidad', '/cambiar-password', '/seguridad',
]

const esDesarrollo = process.env.NODE_ENV !== 'production'

/**
 * Arma la política de la página con el nonce de esta petición.
 * - 'strict-dynamic': un script con nonce puede cargar otros (los chunks de
 *   Next); en navegadores modernos hace que se ignore 'self' en script-src.
 * - 'unsafe-eval' solo en desarrollo (recarga en caliente de webpack).
 * - style-src mantiene 'unsafe-inline': la app usa estilos en línea (style={})
 *   en casi todas las pantallas; los estilos no ejecutan código.
 */
function politica(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${esDesarrollo ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')
}

/**
 * Decide si la petición puede ver la página. Devuelve una redirección si no,
 * o null si puede seguir.
 */
async function controlAcceso(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl
  if (!PROTEGIDAS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  // El token de la cookie lo revalida contra la BD callbacks.jwt (lib/auth.ts)
  // cada vez que el cliente consulta la sesión; si el usuario fue desactivado
  // queda marcado como `revocado` y aquí se le envía al login.
  const token = await getToken({ req })
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, req.url))

  if (!token || token.revocado) return ir('/login')

  // Con cambio de contraseña pendiente solo puede estar en /cambiar-password
  if (token.debe_cambiar_password && pathname !== '/cambiar-password') return ir('/cambiar-password')

  // Admin sin verificación en dos pasos: solo puede estar en /seguridad hasta activarla
  // (después de cambiar la contraseña, si también la tenía pendiente)
  if (token.debe_configurar_2fa && pathname !== '/seguridad') return ir('/seguridad')

  const rol     = token.rol as string
  const modulos = (token.modulos as string[]) ?? []

  // pvn: solo sus pantallas (registro de ventas y pagos QR)
  if (rol === 'pvn') {
    const permitidas = ['/pvn/registrar', '/pvn/subir-qr', '/dashboard', '/cambiar-password']
    if (!permitidas.some(r => pathname.startsWith(r))) return ir('/pvn/subir-qr')
  }

  // pvv: acceso web desde navegador (iPhone u otros sin app Android)
  if (rol === 'pvv') {
    const permitidas = ['/pvn/subir-qr', '/dashboard', '/cambiar-password']
    if (!permitidas.some(r => pathname.startsWith(r))) return ir('/pvn/subir-qr')
  }

  // Auditoría: solo admin
  if (pathname.startsWith('/auditoria') && rol !== 'admin') return ir('/dashboard')

  // Usuarios: admin y lider
  if (pathname.startsWith('/admin') && !['admin', 'lider'].includes(rol)) return ir('/dashboard')

  // Módulos asignables: requieren el módulo correspondiente (admin siempre pasa)
  if (rol !== 'pvn' && rol !== 'pvv') {
    for (const [prefix, modulo] of PATH_MODULO) {
      if (pathname.startsWith(prefix) && !tieneModulo(rol, modulos, modulo)) return ir('/dashboard')
    }
  }
  return null
}

export async function middleware(req: NextRequest) {
  // 1) Permisos: si no puede ver la página, se redirige y no hace falta CSP
  const redireccion = await controlAcceso(req)
  if (redireccion) return redireccion

  // 2) CSP con nonce nuevo en cada petición (UUID aleatorio, 122 bits, en base64)
  const nonce = btoa(crypto.randomUUID())
  const csp = politica(nonce)

  // Next.js toma el nonce del encabezado CSP de la PETICIÓN y lo pone en sus
  // <script>; x-nonce queda disponible por si un componente lo necesita.
  const cabeceras = new Headers(req.headers)
  cabeceras.set('x-nonce', nonce)
  cabeceras.set('Content-Security-Policy', csp)

  const res = NextResponse.next({ request: { headers: cabeceras } })
  // Y en la RESPUESTA, para que el navegador la aplique
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  // Todas las páginas. Se excluyen la API (lleva su propia CSP en
  // next.config.js), los archivos de Next y las imágenes/íconos de /public.
  matcher: ['/((?!api/|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|ico|svg|webp)$).*)'],
}
