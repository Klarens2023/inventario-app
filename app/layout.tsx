import type { Metadata } from 'next'
import './globals.css' // Esto es vital para que no se vea feo
import { Providers } from './providers'

export const metadata: Metadata = {
  title: "Control de Inventario - Klaren's",
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