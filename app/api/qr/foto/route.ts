import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import sharp from 'sharp'
import { getAuthUser } from '@/lib/api-auth'

// Proxy de imágenes: Google Drive bloquea el hotlinking de "uc?export=view"
// cuando se embebe como <img> desde otro dominio (falla silenciosa en el navegador,
// aunque el link funcione en navegación directa). Servimos el archivo nosotros mismos.
//
// ?thumb=1 devuelve una miniatura comprimida en vez del archivo original: las
// listas (Pagos QR, Cierres) muestran las fotos en 44x44px pero sin esto se
// transfería el archivo completo (varios MB) por cada fila — eso es lo que más
// pesaba en "Fast Origin Transfer" de Vercel. Las fotos no cambian una vez
// subidas, así que se puede cachear por mucho tiempo sin riesgo.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const fileId = req.nextUrl.searchParams.get('id')
  if (!fileId) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })
  const esMiniatura = req.nextUrl.searchParams.get('thumb') === '1'

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
    let buffer = Buffer.from(res.data as ArrayBuffer)
    if (esMiniatura) {
      buffer = await sharp(buffer).resize(120, 120, { fit: 'cover' }).jpeg({ quality: 60 }).toBuffer()
    }
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        // private: solo el navegador del usuario cachea, no la CDN de Vercel
        // (el archivo sigue exigiendo sesión autenticada en cada miss real).
        'Cache-Control': 'private, max-age=604800, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la imagen' }, { status: 502 })
  }
}
