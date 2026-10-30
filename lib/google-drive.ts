import { google } from 'googleapis'
import { Readable } from 'stream'
import sharp from 'sharp'

// Comprime antes de subir a Drive: fotos de cámara sin procesar pueden pesar
// varios MB, y eso se paga cada vez que alguien la ve (Fast Origin Transfer
// de Vercel). 1600px de ancho es de sobra para leer un formato firmado o un
// comprobante en el visor ampliado.
export async function comprimirImagen(file: File, maxWidth = 1600, calidad = 80): Promise<File> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const comprimido = await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: calidad })
    .toBuffer()
  return new File([new Uint8Array(comprimido)], file.name, { type: 'image/jpeg' })
}

export async function subirADrive(file: File, nombreArchivo: string): Promise<string> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  const drive = google.drive({ version: 'v3', auth })
  const buffer = Buffer.from(await file.arrayBuffer())
  const stream = Readable.from(buffer)

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: nombreArchivo,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
    },
    media: { mimeType: file.type || 'image/jpeg', body: stream },
    fields: 'id',
  })

  const fileId = res.data.id!
  // El archivo NO se comparte públicamente ("anyone"): app/api/qr/foto lo sirve
  // mediante un proxy que lo descarga con las credenciales de esta misma cuenta
  // de servicio (que ya tiene acceso por haberlo creado), así que no hace falta
  // exponerlo en internet — solo un usuario autenticado en la app puede verlo.
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}

// Google Drive bloquea el hotlinking de "uc?export=view" al embeberlo como <img>
// desde otro dominio, así que las respuestas devuelven nuestra propia URL de proxy.
// Debe ser absoluta (no solo el path): la web la resuelve igual contra su propio
// origen, pero la app móvil (React Native <Image>) no tiene un "origen actual" y
// necesita la URL completa, o la imagen simplemente no carga.
// Genérico: devuelve el mismo tipo de fila que recibe (solo cambia el campo de la foto)
export function aUrlProxy<T extends Record<string, unknown>>(row: T, baseUrl: string, campo: string = 'foto_url'): T {
  const valor = row[campo]
  if (!valor) return row
  const fileId = String(valor).match(/[?&]id=([^&]+)/)?.[1]
  return fileId ? { ...row, [campo]: `${baseUrl}/api/qr/foto?id=${fileId}` } : row
}

/** Id de archivo de Drive dentro de una URL guardada ("...?id=XXXX" o ".../d/XXXX/..."). */
export function idArchivoDrive(url: string | null | undefined): string | null {
  if (!url) return null
  return url.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1] ?? url.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1] ?? null
}

/**
 * Manda un archivo a la papelera de Drive (no lo borra definitivamente: en una
 * unidad compartida, Google lo elimina solo a los 30 días y mientras tanto se
 * puede restaurar). Lo usa la depuración de fotos de pagos (lib/depurarFotos.ts).
 * @returns 'papelera', o 'no-existe' si ya no estaba (p. ej. se borró a mano)
 */
export async function enviarAPapelera(fileId: string): Promise<'papelera' | 'no-existe'> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  const drive = google.drive({ version: 'v3', auth })
  try {
    await drive.files.update({ fileId, supportsAllDrives: true, requestBody: { trashed: true } })
    return 'papelera'
  } catch (e) {
    const codigo = (e as { code?: number }).code
    if (codigo === 404) return 'no-existe'
    throw e
  }
}

export function limpiarNombreArchivo(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_')
}
