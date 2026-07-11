import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthUser } from '@/lib/api-auth'

// Proxy de imágenes: Google Drive bloquea el hotlinking de "uc?export=view"
// cuando se embebe como <img> desde otro dominio (falla silenciosa en el navegador,
// aunque el link funcione en navegación directa). Servimos el archivo nosotros mismos.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const fileId = req.nextUrl.searchParams.get('id')
  if (!fileId) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  const drive = google.drive({ version: 'v3', auth })

  try {
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    )
    return new NextResponse(Buffer.from(res.data as ArrayBuffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la imagen' }, { status: 502 })
  }
}
