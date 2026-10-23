import type { Metadata } from 'next'
import './globals.css' // Esto es vital para que no se vea feo
import { Providers } from './providers'

// La CSP con nonce (middleware.ts) obliga a generar cada página en cada
// petición: una página pre-generada en el build tendría scripts sin el nonce
// de la petición actual y el navegador los bloquearía.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Operaciones - Klaren's",
  description: 'Sistema de control y conteo de inventario',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}