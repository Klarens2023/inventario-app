import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { tieneModulo, type Modulo } from '@/lib/permissions'

const PATH_MODULO: Array<[string, Modulo]> = [
  ['/cargar', 'cargar'],
  ['/consulta', 'consulta'],
  ['/acumulados', 'acumulados'],
  ['/pvn/historial', 'pvn_historial'],
  ['/pvn/analisis', 'pvn_analisis'],
  ['/pvn/catalogo', 'pvn_catalogo'],
  ['/pvn/pagos-qr', 'pvn_pagos_qr'],
  ['/sistemas', 'equipos'],
]

export async function middleware(req: NextRequest) {
  const token = await getToken({ req })
  const { pathname } = req.nextUrl

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (token.debe_cambiar_password && pathname !== '/cambiar-password') {
    return NextResponse.redirect(new URL('/cambiar-password', req.url))
  }

  const rol     = token.rol as string
  const modulos = (token.modulos as string[]) ?? []

  // Bloquear al rol pvn fuera de sus rutas permitidas
  if (rol === 'pvn') {
    const permitidas = ['/pvn/registrar', '/pvn/subir-qr', '/dashboard', '/cambiar-password']
    if (!permitidas.some(r => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/pvn/subir-qr', req.url))
    }
  }

  // pvv: acceso web desde navegador (iPhone u otros sin app Android)
  if (rol === 'pvv') {
    const permitidas = ['/pvn/subir-qr', '/dashboard', '/cambiar-password']
    if (!permitidas.some(r => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/pvn/subir-qr', req.url))
    }
  }

  // Auditoría: solo admin
  if (pathname.startsWith('/auditoria') && rol !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Usuarios: admin y lider
  if (pathname.startsWith('/admin') && !['admin', 'lider'].includes(rol)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Módulos asignables: requieren el módulo correspondiente (admin siempre pasa)
  if (rol !== 'pvn' && rol !== 'pvv') {
    for (const [prefix, modulo] of PATH_MODULO) {
      if (pathname.startsWith(prefix) && !tieneModulo(rol, modulos, modulo)) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
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
    '/pvn/:path*',
    '/cambiar-password',
  ],
}
