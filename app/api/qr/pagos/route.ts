import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import sharp from 'sharp'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'

async function agregarEtiqueta(
  buffer: Buffer,
  fecha: string,
  hora: string,
  sede: string,
  usuario: string
): Promise<Buffer> {
  const img = sharp(buffer)
  const { width = 800 } = await img.metadata()

  const linea1 = `${fecha}  ${hora}`
  const linea2 = `${sede}  ·  ${usuario}`
  const altoBanner = 52
  const fontSize = 15

  const svg = `
    <svg width="${width}" height="${altoBanner}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${altoBanner}" fill="rgba(0,0,0,0.72)"/>
      <text x="14" y="20" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white" font-weight="bold">${linea1}</text>
      <text x="14" y="42" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#93c5fd">${linea2}</text>
    </svg>`

  return img
    .composite([{
      input: Buffer.from(svg),
      gravity: 'south',
    }])
    .jpeg({ quality: 85 })
    .toBuffer()
}

async function subirADrive(file: File, nombreArchivo: string): Promise<string> {
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
  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return `https://drive.google.com/uc?export=view&id=${fileId}`
}

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['pvn', 'pvv'].includes(user.rol)) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const form = await req.formData()
  const foto = form.get('foto') as File | null
  const valor = parseFloat(String(form.get('valor') ?? ''))
  const puntoVentaIdRaw = form.get('punto_venta_id')

  if (!foto) return NextResponse.json({ error: 'La foto es obligatoria' }, { status: 400 })
  if (!valor || valor <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  if (foto.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen es muy pesada (máx 8MB)' }, { status: 413 })
  }

  // Sesiones web requieren turno abierto; la app móvil (Bearer token) conserva flujo libre
  const esWeb = !req.headers.get('authorization')?.startsWith('Bearer ')
  let puntoVentaId: number | null

  if (esWeb) {
    const hoy = hoyBogota()
    const [turno] = await sql`
      SELECT punto_venta_id FROM pvn_turnos
      WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date AND activo = TRUE
      LIMIT 1
    `
    if (!turno) return NextResponse.json({ error: 'Debes abrir un turno antes de registrar pagos' }, { status: 403 })
    puntoVentaId = turno.punto_venta_id
  } else if (user.rol === 'pvn') {
    puntoVentaId = user.punto_venta_id
    if (!puntoVentaId) return NextResponse.json({ error: 'Tu usuario no tiene un punto de venta asignado' }, { status: 400 })
  } else {
    puntoVentaId = puntoVentaIdRaw ? parseInt(String(puntoVentaIdRaw)) : null
    if (!puntoVentaId) return NextResponse.json({ error: 'Debes seleccionar un punto de venta' }, { status: 400 })
  }

  const [pv] = await sql`SELECT id, nombre FROM pvn_puntos_venta WHERE id = ${puntoVentaId} LIMIT 1`
  if (!pv) return NextResponse.json({ error: 'Punto de venta inválido' }, { status: 400 })

  const fecha = hoyBogota()
  const ahora = new Date()
  const hora  = ahora.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const horaArchivo = hora.replace(/:/g, '-')
  const sede  = pv.nombre.replace(/[^a-zA-Z0-9]/g, '_')
  const nombreUsuario = user.name.replace(/[^a-zA-Z0-9]/g, '_')
  const nombreArchivo = `${fecha}_${horaArchivo}_${sede}_${nombreUsuario}.jpg`

  const bufferOriginal  = Buffer.from(await foto.arrayBuffer())
  const bufferEtiquetado = await agregarEtiqueta(bufferOriginal, fecha, hora, pv.nombre, user.name)
  const fotoConEtiqueta  = new File([new Uint8Array(bufferEtiquetado)], nombreArchivo, { type: 'image/jpeg' })
  const fotoUrl = await subirADrive(fotoConEtiqueta, nombreArchivo)
  const [registro] = await sql`
    INSERT INTO pvn_pagos_qr (usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre, fecha, valor, foto_url)
    VALUES (${parseInt(user.id)}, ${user.name}, ${pv.id}, ${pv.nombre}, ${fecha}::date, ${valor}, ${fotoUrl})
    RETURNING id, fecha::text AS fecha, valor, foto_url, created_at
  `

  await logAudit({
    usuarioId: user.id,
    usuarioNombre: user.name,
    accion: 'PVN_PAGO_QR_REGISTRADO',
    descripcion: `Registró pago QR de ${valor} en ${pv.nombre}`,
    datos: { punto_venta: pv.nombre, valor },
  })

  return NextResponse.json(registro, { status: 201 })
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // pvn/pvv solo ven sus propios pagos del día de hoy (no el historial completo)
  if (['pvn', 'pvv'].includes(user.rol)) {
    const hoy = hoyBogota()
    const rows = await sql(
      `SELECT id, punto_venta_nombre, fecha::text AS fecha, valor, foto_url, created_at
       FROM pvn_pagos_qr
       WHERE usuario_id = $1 AND fecha = $2::date
       ORDER BY created_at DESC`,
      [parseInt(user.id), hoy]
    )
    return NextResponse.json(rows)
  }

  if (!tieneModulo(user.rol, user.modulos, 'pvn_pagos_qr')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const pvId  = searchParams.get('punto_venta_id')

  const rows = await sql(
    `SELECT id, usuario_nombre, punto_venta_id, punto_venta_nombre,
            fecha::text AS fecha, valor, foto_url, created_at
     FROM pvn_pagos_qr
     WHERE ($1::date IS NULL OR fecha >= $1::date)
       AND ($2::date IS NULL OR fecha <= $2::date)
       AND ($3::int IS NULL OR punto_venta_id = $3::int)
     ORDER BY fecha DESC, created_at DESC
     LIMIT 200`,
    [desde, hasta, pvId ? parseInt(pvId) : null]
  )
  return NextResponse.json(rows)
}
