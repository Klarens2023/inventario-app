/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Evita que la app se cargue en un iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Evita que el navegador adivine el tipo de contenido
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Controla cuánta información de referencia se envía
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Desactiva funciones del navegador que no se usan
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Fuerza HTTPS por 1 año
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Activa filtro XSS en navegadores antiguos
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
