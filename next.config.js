/** @type {import('next').NextConfig} */

// Content-Security-Policy (AUD-24).
// La de las PÁGINAS la arma middleware.ts con un nonce distinto en cada
// petición (sin 'unsafe-inline' para scripts). Aquí solo queda la de la API:
// sus respuestas son JSON o archivos, nunca HTML que deba ejecutar algo, así
// que se niega todo ('none') y no se permite incrustarlas en otro sitio.
const cspApi = "default-src 'none'; frame-ancestors 'none'"

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
  // X-XSS-Protection se retiró: está obsoleto y la protección la da la CSP.
]

const nextConfig = {
  // ssh2 trae módulos nativos opcionales que webpack no puede empaquetar.
  // (En Next 14 era experimental.serverComponentsExternalPackages.)
  serverExternalPackages: ['bcryptjs', 'ssh2', 'ssh2-sftp-client'],
  async headers() {
    return [
      // Encabezados de seguridad comunes a todo el sitio
      { source: '/(.*)', headers: securityHeaders },
      // CSP estricta para la API (la de las páginas la pone middleware.ts)
      { source: '/api/:path*', headers: [{ key: 'Content-Security-Policy', value: cspApi }] },
    ]
  },
}

module.exports = nextConfig
