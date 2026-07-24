import { google } from 'googleapis'
import { Readable } from 'stream'

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
export function aUrlProxy(row: Record<string, any>, baseUrl: string, campo: string = 'foto_url'): Record<string, any> {
  const valor = row[campo]
  if (!valor) return row
  const fileId = String(valor).match(/[?&]id=([^&]+)/)?.[1]
  return fileId ? { ...row, [campo]: `${baseUrl}/api/qr/foto?id=${fileId}` } : row
}

export function limpiarNombreArchivo(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_')
}
