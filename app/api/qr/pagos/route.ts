import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'

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

  const ext = (foto.name?.split('.').pop() || 'jpg').toLowerCase()
  const blobName = `qr-pagos/${pv.id}/${Date.now()}-${user.id}.${ext}`
  const blob = await put(blobName, foto, { access: 'public', addRandomSuffix: true })

  const fecha = hoyBogota()
  const [registro] = await sql`
    INSERT INTO pvn_pagos_qr (usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre, fecha, valor, foto_url)
    VALUES (${parseInt(user.id)}, ${user.name}, ${pv.id}, ${pv.nombre}, ${fecha}::date, ${valor}, ${blob.url})
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
