import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req })
  const { pathname } = req.nextUrl

  // Sin sesión → login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Primer ingreso: forzar cambio de contraseña
  if (token.debe_cambiar_password && pathname !== '/cambiar-password') {
    return NextResponse.redirect(new URL('/cambiar-password', req.url))
  }

  // Rutas exclusivas del admin
  if (
    (pathname.startsWith('/auditoria') || pathname.startsWith('/admin')) &&
    token.rol !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/cargar/:path*',
    '/consulta/:path*',
    '/acumulados/:path*',
    '/auditoria/:path*',
    '/admin/:path*',
    '/cambiar-password',
  ],
}
