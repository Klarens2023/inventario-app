#!/usr/bin/env node
/**
 * Manejo de los respaldos de la base de datos en Google Drive.
 * Lo usa .github/workflows/respaldo-bd.yml; ver docs/RESPALDOS.md.
 *
 *   node scripts/respaldo-drive.mjs subir <archivo>         sube el respaldo cifrado
 *   node scripts/respaldo-drive.mjs limpiar                 borra los de más de RESPALDO_DIAS días
 *   node scripts/respaldo-drive.mjs descargar-ultimo <ruta> baja el más reciente (prueba de restauración)
 *
 * Variables de entorno (secretos de GitHub):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY  la misma cuenta de servicio que sube las fotos
 *   RESPALDO_DRIVE_FOLDER_ID                          carpeta SOLO para respaldos (no la de fotos)
 *   RESPALDO_DIAS                                     días que se conservan (por defecto 30)
 *
 * El repositorio es público y los logs de Actions también: este script nunca
 * imprime datos, solo nombres de archivo, tamaños y cantidades.
 */
import { google } from 'googleapis'
import { createReadStream, createWriteStream, statSync } from 'node:fs'
import { basename } from 'node:path'
import { pipeline } from 'node:stream/promises'

const PREFIJO = 'respaldo-neondb-'
const CARPETA = process.env.RESPALDO_DRIVE_FOLDER_ID
const DIAS = Number(process.env.RESPALDO_DIAS ?? 30)

if (!CARPETA || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY o RESPALDO_DRIVE_FOLDER_ID')
  process.exit(1)
}

// drive.file: la cuenta solo ve y borra los archivos que ella misma creó
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
})
const drive = google.drive({ version: 'v3', auth })

/** Respaldos de la carpeta, del más nuevo al más viejo. */
async function listar() {
  const archivos = []
  let pageToken
  do {
    const { data } = await drive.files.list({
      q: `'${CARPETA}' in parents and name contains '${PREFIJO}' and trashed = false`,
      fields: 'nextPageToken, files(id, name, size, createdTime)',
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
      pageToken,
    })
    archivos.push(...(data.files ?? []))
    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)
  return archivos
}

const mb = bytes => (Number(bytes) / 1024 / 1024).toFixed(2) + ' MB'

async function subir(ruta) {
  const nombre = basename(ruta)
  if (!nombre.startsWith(PREFIJO)) throw new Error(`El archivo debe llamarse ${PREFIJO}…`)
  const { data } = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: nombre, parents: [CARPETA] },
    media: { mimeType: 'application/octet-stream', body: createReadStream(ruta) },
    fields: 'id, size',
  })
  // Comprobación: el tamaño en Drive debe ser igual al del archivo local
  const local = statSync(ruta).size
  if (Number(data.size) !== local) throw new Error(`Tamaño distinto en Drive (${data.size} vs ${local})`)
  console.log(`Subido ${nombre} (${mb(local)})`)
}

async function limpiar() {
  const limite = Date.now() - DIAS * 24 * 60 * 60 * 1000
  const todos = await listar()
  // Nunca se borra el más reciente, aunque sea viejo (p. ej. si el respaldo dejó de correr)
  const viejos = todos.slice(1).filter(a => new Date(a.createdTime).getTime() < limite)
  for (const a of viejos) {
    await drive.files.delete({ fileId: a.id, supportsAllDrives: true })
    console.log(`Borrado ${a.name}`)
  }
  console.log(`Respaldos en Drive: ${todos.length - viejos.length} (se conservan ${DIAS} días)`)
}

async function descargarUltimo(destino) {
  const [ultimo] = await listar()
  if (!ultimo) throw new Error('No hay respaldos en la carpeta')
  const res = await drive.files.get(
    { fileId: ultimo.id, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  )
  await pipeline(res.data, createWriteStream(destino))
  console.log(`Descargado ${ultimo.name} (${mb(ultimo.size)}), creado ${ultimo.createdTime}`)
}

const [accion, arg] = process.argv.slice(2)
const acciones = { subir: () => subir(arg), limpiar, 'descargar-ultimo': () => descargarUltimo(arg) }
if (!acciones[accion]) { console.error('Uso: subir <archivo> | limpiar | descargar-ultimo <ruta>'); process.exit(1) }
acciones[accion]().catch(e => { console.error('Error:', e.message); process.exit(1) })
