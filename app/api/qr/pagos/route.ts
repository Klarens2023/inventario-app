import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'
import { subirADrive, aUrlProxy } from '@/lib/google-drive'

async function agregarEtiqueta(
  buffer: Buffer,
  fecha: string,
  hora: string,
  sede: string,
  usuario: string
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const width  = meta.width  ?? 800
  const height = meta.height ?? 600

  const linea1 = `${fecha}  ${hora}`
  const linea2 = `${sede}  ·  ${usuario}`
  // El banner nunca puede ser más alto que la propia foto, o sharp rechaza el
  // composite ("Image to composite must have same dimensions or smaller") —
  // pasaba con fotos de aspecto poco común (ej. capturas muy alargadas).
  const altoBanner = Math.min(52, height)
  const fontSize = 15

  const svg = `
    <svg width="${width}" height="${altoBanner}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${altoBanner}" fill="rgba(0,0,0,0.72)"/>
      <text x="14" y="20" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white" font-weight="bold">${linea1}</text>
      <text x="14" y="42" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#93c5fd">${linea2}</text>
    </svg>`

  try {
    return await sharp(buffer)
      .composite([{
        input: Buffer.from(svg),
        gravity: 'south',
      }])
      .jpeg({ quality: 85 })
      .toBuffer()
  } catch {
    // Si la superposición falla por alguna dimensión atípica, se sube la foto
    // tal cual en vez de bloquear el registro del pago (que sí es obligatorio).
    return sharp(buffer).jpeg({ quality: 85 }).toBuffer()
  }
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
  const turnoIdForm = form.get('turno_id') as string | null

  if (!foto) return NextResponse.json({ error: 'La foto es obligatoria' }, { status: 400 })
  if (!valor || valor <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  if (!foto.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
  }
  if (foto.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen es muy pesada (máx 8MB)' }, { status: 413 })
  }

  const hoy = hoyBogota()

  // Se exige turno abierto para TODOS (pvn, pvv fija y pvv rotativa): así el
  // pago siempre queda asociado a un turno_id y no se pueden colar registros
  // "huérfanos" que después no aparecen en "Mis pagos de hoy" de nadie.
  //
  // Si viene `turno_id` explícito (carga tardía de QR de un turno pendiente
  // de un día anterior, antes de cerrarlo), se usa ESE turno en vez de
  // exigir que sea el de hoy — pero siempre validando que sea del mismo
  // usuario y que siga abierto, para no dejar que alguien registre pagos en
  // un turno ajeno o ya cerrado.
  let turno
  if (turnoIdForm) {
    const turnoIdNum = parseInt(turnoIdForm)
    const [t] = await sql`
      SELECT id, punto_venta_id, punto_venta_nombre, fecha::text AS fecha FROM pvn_turnos
      WHERE id = ${turnoIdNum} AND usuario_id = ${parseInt(user.id)} AND activo = TRUE
      LIMIT 1
    `
    turno = t
  } else {
    const [t] = await sql`
      SELECT id, punto_venta_id, punto_venta_nombre, fecha::text AS fecha FROM pvn_turnos
      WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date AND activo = TRUE
      LIMIT 1
    `
    turno = t
  }
  if (!turno) {
    return NextResponse.json({ error: 'Debes tener un turno abierto para registrar pagos. Si el problema persiste, cierra sesión y vuelve a entrar.' }, { status: 403 })
  }

  // El pago queda fechado en el día real del turno (no en el día de la
  // subida), para que la carga tardía de un turno pendiente se refleje en
  // su fecha original y no se mezcle con las ventas del turno nuevo.
  const fecha = turno.fecha as string
  const ahora = new Date()
  const hora  = ahora.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const horaArchivo = hora.replace(/:/g, '-')
  const sede  = turno.punto_venta_nombre.replace(/[^a-zA-Z0-9]/g, '_')
  const nombreUsuario = user.name.replace(/[^a-zA-Z0-9]/g, '_')
  const nombreArchivo = `${fecha}_${horaArchivo}_${sede}_${nombreUsuario}.jpg`

  const bufferOriginal  = Buffer.from(await foto.arrayBuffer())
  const bufferEtiquetado = await agregarEtiqueta(bufferOriginal, fecha, hora, turno.punto_venta_nombre, user.name)
  const fotoConEtiqueta  = new File([new Uint8Array(bufferEtiquetado)], nombreArchivo, { type: 'image/jpeg' })
  const fotoUrl = await subirADrive(fotoConEtiqueta, nombreArchivo)
  const [registro] = await sql`
    INSERT INTO pvn_pagos_qr (usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre, turno_id, fecha, valor, foto_url)
    VALUES (${parseInt(user.id)}, ${user.name}, ${turno.punto_venta_id}, ${turno.punto_venta_nombre}, ${turno.id}, ${fecha}::date, ${valor}, ${fotoUrl})
    RETURNING id, fecha::text AS fecha, valor, foto_url, created_at
  `

  await logAudit({
    usuarioId: user.id,
    usuarioNombre: user.name,
    accion: 'PVN_PAGO_QR_REGISTRADO',
    descripcion: `Registró pago QR de ${valor} en ${turno.punto_venta_nombre}`,
    datos: { punto_venta: turno.punto_venta_nombre, valor },
  })

  return NextResponse.json(aUrlProxy(registro, req.nextUrl.origin), { status: 201 })
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // pvn/pvv solo ven los pagos de su turno actual (o de un turno específico
  // de hoy vía ?turno_id=, para "turnos anteriores" si trabajaron en más de
  // un punto el mismo día) — no el historial completo.
  if (['pvn', 'pvv'].includes(user.rol)) {
    const hoy = hoyBogota()
    const turnoIdParam = req.nextUrl.searchParams.get('turno_id')

    let turnoId: number | null
    if (turnoIdParam) {
      turnoId = parseInt(turnoIdParam)
    } else {
      const [turnoActivo] = await sql`
        SELECT id FROM pvn_turnos
        WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date AND activo = TRUE
        LIMIT 1
      `
      turnoId = turnoActivo?.id ?? null
    }

    if (!turnoId) return NextResponse.json([])

    const rows = await sql(
      `SELECT id, punto_venta_nombre, fecha::text AS fecha, valor, foto_url, created_at
       FROM pvn_pagos_qr
       WHERE usuario_id = $1 AND fecha = $2::date AND turno_id = $3
       ORDER BY created_at DESC`,
      [parseInt(user.id), hoy, turnoId]
    )
    return NextResponse.json(rows.map(r => aUrlProxy(r, req.nextUrl.origin)))
  }

  if (!tieneModulo(user.rol, user.modulos, 'pvn_pagos_qr')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const pvId  = searchParams.get('punto_venta_id')
  const usuarioId = searchParams.get('usuario_id')

  // Sin LIMIT: esta consulta alimenta tanto la tabla como la exportación a
  // Excel, y truncar en silencio descartaba fechas completas del rango
  // filtrado sin avisar (las más antiguas, por el ORDER BY fecha DESC).
  const rows = await sql(
    `SELECT id, usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre,
            fecha::text AS fecha, valor, foto_url, created_at
     FROM pvn_pagos_qr
     WHERE ($1::date IS NULL OR fecha >= $1::date)
       AND ($2::date IS NULL OR fecha <= $2::date)
       AND ($3::int IS NULL OR punto_venta_id = $3::int)
       AND ($4::int IS NULL OR usuario_id = $4::int)
     ORDER BY fecha DESC, created_at DESC`,
    [desde, hasta, pvId ? parseInt(pvId) : null, usuarioId ? parseInt(usuarioId) : null]
  )
  return NextResponse.json(rows.map(r => aUrlProxy(r, req.nextUrl.origin)))
}
