import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req })
  const { pathname } = req.nextUrl

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (token.debe_cambiar_password && pathname !== '/cambiar-password') {
    return NextResponse.redirect(new URL('/cambiar-password', req.url))
  }

  const rol  = token.rol as string
  const area = (token.area as string) ?? (rol === 'admin' ? 'general' : 'logistica')

  // Auditoría: solo admin
  if (pathname.startsWith('/auditoria') && rol !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Usuarios: admin y lider
  if (pathname.startsWith('/admin') && !['admin', 'lider'].includes(rol)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Módulo sistemas: solo área sistemas o general
  if (pathname.startsWith('/sistemas') && !['sistemas', 'general'].includes(area)) {
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
    '/sistemas/:path*',
    '/cambiar-password',
  ],
}
