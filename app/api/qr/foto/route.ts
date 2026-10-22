import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import sharp from 'sharp'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

// Proxy de imágenes: Google Drive bloquea el hotlinking de "uc?export=view"
// cuando se embebe como <img> desde otro dominio (falla silenciosa en el navegador,
// aunque el link funcione en navegación directa). Servimos el archivo nosotros mismos.
//
// ?thumb=1 devuelve una miniatura comprimida en vez del archivo original: las
// listas (Pagos QR, Cierres) muestran las fotos en 44x44px pero sin esto se
// transfería el archivo completo (varios MB) por cada fila — eso es lo que más
// pesaba en "Fast Origin Transfer" de Vercel.
//
// Cache-Control público (decisión consciente, no descuido): una vez que un
// usuario autenticado carga la foto, la CDN de Vercel la guarda y la sirve
// directo a cualquiera con esa URL exacta, sin volver a pasar por esta función
// ni re-verificar sesión — el fileId de Drive funciona como el "secreto" (larga
// cadena aleatoria, no es adivinable ni aparece listado en ningún lado público).
// Se aceptó este trade-off para bajar el consumo del plan Hobby de Vercel; si
// se necesita revocar acceso a una foto puntual, hay que rotar/borrar el archivo
// en Drive, no basta con cambiar permisos en la app.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const fileId = req.nextUrl.searchParams.get('id')
  if (!fileId) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })
  // Los ids de Drive son alfanuméricos con - y _; cualquier otra cosa no es un id nuestro.
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
  const esMiniatura = req.nextUrl.searchParams.get('thumb') === '1'

  // Control por registro (AUD-27): la cuenta de servicio puede leer cualquier archivo
  // que haya subido, así que solo se entrega si el fileId pertenece a un registro que
  // este usuario puede ver: pagos y cierres de turno propios (o todos con el módulo
  // pvn_pagos_qr) y formatos firmados de movimientos TIC (con el módulo movimientos_tic).
  // 404 y no 403 para no confirmar si el archivo existe.
  const verPagos = tieneModulo(user.rol, user.modulos, 'pvn_pagos_qr')
  const verTic = tieneModulo(user.rol, user.modulos, 'movimientos_tic')
  const uid = parseInt(user.id)
  const [permitido] = await sql`
    SELECT 1 FROM pvn_pagos_qr
    WHERE substring(foto_url from '[?&]id=([^&]+)') = ${fileId} AND (${verPagos} OR usuario_id = ${uid})
    UNION ALL
    SELECT 1 FROM pvn_turnos
    WHERE substring(foto_datafono_url from '[?&]id=([^&]+)') = ${fileId} AND (${verPagos} OR usuario_id = ${uid})
    UNION ALL
    SELECT 1 FROM tic_movimientos
    WHERE substring(foto_autorizacion_url from '[?&]id=([^&]+)') = ${fileId} AND ${verTic}
    LIMIT 1
  `
  if (!permitido) return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 })

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
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la imagen' }, { status: 502 })
  }
}
