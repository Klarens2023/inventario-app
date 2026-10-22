/** @type {import('next').NextConfig} */

// Content-Security-Policy (AUD-24). Limita de dónde se cargan scripts, estilos,
// imágenes y a dónde puede conectarse la página: aunque se colara un XSS, no
// podría enviar datos a otro dominio (connect-src/img-src 'self'), cargar
// scripts externos, incrustar la app en otro sitio ni cambiar <base>.
// 'unsafe-inline' en script-src es necesario porque Next 15 sin nonces inyecta
// scripts en línea, y los formatos imprimibles usan window.onload en línea;
// 'unsafe-eval' solo en desarrollo (recarga en caliente de webpack).
// Google Fonts: app/globals.css importa la fuente desde fonts.googleapis.com.
const esDesarrollo = process.env.NODE_ENV !== 'production'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
  // X-XSS-Protection se retiró: está obsoleto y la protección la da la CSP.
]

const nextConfig = {
  // ssh2 trae módulos nativos opcionales que webpack no puede empaquetar.
  // (En Next 14 era experimental.serverComponentsExternalPackages.)
  serverExternalPackages: ['bcryptjs', 'ssh2', 'ssh2-sftp-client'],
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
