import type { Metadata } from 'next'
import { Providers } from '../providers' // (o el nombre que tenga exportado)

export const metadata: Metadata = {
  title: 'Control de Inventario',
  description: 'Sistema de control y conteo de inventario',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}