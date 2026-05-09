export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/cargar/:path*', '/consulta/:path*', '/acumulados/:path*', '/auditoria/:path*'],
}
