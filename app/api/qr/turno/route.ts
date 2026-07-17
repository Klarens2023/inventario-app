import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { subirADrive, limpiarNombreArchivo, aUrlProxy } from '@/lib/google-drive'

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

const MAX_BYTES = 8 * 1024 * 1024

// GET /api/qr/turno — turno abierto hoy para el usuario autenticado
// Con ?pendiente=true también devuelve turno sin cerrar de días anteriores
// Con ?historial=true devuelve todos los turnos de hoy (para "turnos anteriores")
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['pvn', 'pvv'].includes(user.rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const hoy = hoyBogota()

  if (req.nextUrl.searchParams.get('historial') === 'true') {
    const turnos = await sql`
      SELECT id, punto_venta_id, punto_venta_nombre, fecha::text AS fecha, abierto_at, cerrado_at, activo,
             foto_datafono_url, numero_recogida
      FROM pvn_turnos
      WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date
      ORDER BY abierto_at DESC
    `
    return NextResponse.json(turnos.map(t => aUrlProxy(t, req.nextUrl.origin, 'foto_datafono_url')))
  }

  const [turno] = await sql`
    SELECT id, punto_venta_id, punto_venta_nombre, fecha::text AS fecha, abierto_at, activo
    FROM pvn_turnos
    WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date AND activo = TRUE
    LIMIT 1
  `

  const incluirPendiente = req.nextUrl.searchParams.get('pendiente') === 'true'
  if (!incluirPendiente) return NextResponse.json(turno ?? null)

  const [pendiente] = await sql`
    SELECT id, punto_venta_id, punto_venta_nombre, fecha::text AS fecha, abierto_at
    FROM pvn_turnos
    WHERE usuario_id = ${parseInt(user.id)} AND fecha < ${hoy}::date AND activo = TRUE
    ORDER BY fecha DESC
    LIMIT 1
  `
  return NextResponse.json({ turnoHoy: turno ?? null, turnoPendiente: pendiente ?? null })
}

// POST /api/qr/turno — abrir o cerrar turno
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['pvn', 'pvv'].includes(user.rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const contentType = req.headers.get('content-type') ?? ''
  const esMultipart = contentType.includes('multipart/form-data')

  let body: Record<string, unknown> = {}
  let fotoDatafono: File | null = null
  let accion: string

  if (esMultipart) {
    const form = await req.formData()
    accion = String(form.get('accion') ?? '')
    body = { turno_id: form.get('turno_id'), numero_recogida: form.get('numero_recogida') }
    fotoDatafono = form.get('foto_datafono') as File | null
  } else {
    body = await req.json()
    accion = String(body.accion ?? '')
  }

  const hoy = hoyBogota()

  if (accion === 'abrir') {
    // No se puede abrir un turno nuevo si ya hay uno activo hoy: debe cerrarse primero
    const [existente] = await sql`
      SELECT id FROM pvn_turnos
      WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date AND activo = TRUE
    `
    if (existente) return NextResponse.json({ error: 'Ya tienes un turno abierto hoy. Ciérralo antes de abrir uno nuevo.' }, { status: 409 })

    let puntoVentaId: number
    let puntoVentaNombre: string

    if (user.rol === 'pvn') {
      if (!user.punto_venta_id) return NextResponse.json({ error: 'Tu usuario no tiene punto de venta asignado' }, { status: 400 })
      puntoVentaId = user.punto_venta_id
      const [pv] = await sql`SELECT nombre FROM pvn_puntos_venta WHERE id = ${puntoVentaId}`
      if (!pv) return NextResponse.json({ error: 'Punto de venta no encontrado' }, { status: 400 })
      puntoVentaNombre = pv.nombre
    } else if (user.punto_venta_id) {
      // pvv con punto de venta fijo asignado
      puntoVentaId = user.punto_venta_id
      const [pv] = await sql`SELECT nombre FROM pvn_puntos_venta WHERE id = ${puntoVentaId}`
      if (!pv) return NextResponse.json({ error: 'Punto de venta no encontrado' }, { status: 400 })
      puntoVentaNombre = pv.nombre
    } else {
      // pvv rotativa: elige el punto en cada apertura
      const pvId = parseInt(String(body.punto_venta_id))
      if (!pvId) return NextResponse.json({ error: 'Debes seleccionar un punto de venta' }, { status: 400 })
      const [pv] = await sql`SELECT id, nombre FROM pvn_puntos_venta WHERE id = ${pvId} AND activo = TRUE`
      if (!pv) return NextResponse.json({ error: 'Punto de venta inválido' }, { status: 400 })
      puntoVentaId = pv.id
      puntoVentaNombre = pv.nombre
    }

    const [turno] = await sql`
      INSERT INTO pvn_turnos (usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre, fecha)
      VALUES (${parseInt(user.id)}, ${user.name}, ${puntoVentaId}, ${puntoVentaNombre}, ${hoy}::date)
      RETURNING id, punto_venta_id, punto_venta_nombre, fecha::text AS fecha, abierto_at
    `

    await logAudit({
      usuarioId: user.id,
      usuarioNombre: user.name,
      accion: 'PVN_TURNO_ABIERTO',
      descripcion: `Abrió turno en ${puntoVentaNombre}`,
      datos: { punto_venta: puntoVentaNombre, fecha: hoy },
    })

    return NextResponse.json(turno, { status: 201 })
  }

  if (accion === 'cerrar') {
    // turno_id explícito (p.ej. cierre de un turno pendiente de un día anterior);
    // sin él, cierra el turno activo de hoy
    const turnoId = body.turno_id ? parseInt(String(body.turno_id)) : null

    // El cierre de turno PVV (fijo o rotativo) exige foto del cierre del
    // datafono + número de recogida del cuadre de caja; PVN no lo requiere.
    let fotoDatafonoUrl: string | null = null
    let numeroRecogida: string | null = null

    if (user.rol === 'pvv') {
      const numeroRaw = String(body.numero_recogida ?? '').trim()
      if (!fotoDatafono || fotoDatafono.size === 0) {
        return NextResponse.json({ error: 'Debes adjuntar la foto del cierre del datafono' }, { status: 400 })
      }
      if (!/^\d+$/.test(numeroRaw)) {
        return NextResponse.json({ error: 'Ingresa un número de recogida válido (solo dígitos)' }, { status: 400 })
      }
      if (fotoDatafono.size > MAX_BYTES) {
        return NextResponse.json({ error: 'La foto es muy pesada (máx 8MB)' }, { status: 413 })
      }

      const [turnoInfo] = turnoId
        ? await sql`SELECT punto_venta_nombre, fecha::text AS fecha FROM pvn_turnos WHERE id = ${turnoId} AND usuario_id = ${parseInt(user.id)} AND activo = TRUE`
        : await sql`SELECT punto_venta_nombre, fecha::text AS fecha FROM pvn_turnos WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date AND activo = TRUE`
      if (!turnoInfo) return NextResponse.json({ error: 'No hay turno abierto para cerrar' }, { status: 404 })

      numeroRecogida = numeroRaw
      const ahora = new Date()
      const horaArchivo = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour12: false }).replace(/:/g, '-')
      const nombreArchivo = `${limpiarNombreArchivo(turnoInfo.punto_venta_nombre)}_RG1_${numeroRecogida}_${limpiarNombreArchivo(user.name)}_${turnoInfo.fecha}_${horaArchivo}.jpg`
      fotoDatafonoUrl = await subirADrive(fotoDatafono, nombreArchivo)
    }

    const [turno] = turnoId
      ? await sql`
          UPDATE pvn_turnos
          SET activo = FALSE, cerrado_at = NOW(),
              foto_datafono_url = COALESCE(${fotoDatafonoUrl}, foto_datafono_url),
              numero_recogida = COALESCE(${numeroRecogida}, numero_recogida)
          WHERE id = ${turnoId} AND usuario_id = ${parseInt(user.id)} AND activo = TRUE
          RETURNING id, punto_venta_nombre, fecha::text AS fecha
        `
      : await sql`
          UPDATE pvn_turnos
          SET activo = FALSE, cerrado_at = NOW(),
              foto_datafono_url = COALESCE(${fotoDatafonoUrl}, foto_datafono_url),
              numero_recogida = COALESCE(${numeroRecogida}, numero_recogida)
          WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${hoy}::date AND activo = TRUE
          RETURNING id, punto_venta_nombre, fecha::text AS fecha
        `
    if (!turno) return NextResponse.json({ error: 'No hay turno abierto para cerrar' }, { status: 404 })

    // También registrar cierre de día en auditoría
    const [resumen] = await sql`
      SELECT COUNT(*)::int AS total_pagos, COALESCE(SUM(valor), 0) AS total_valor
      FROM pvn_pagos_qr
      WHERE usuario_id = ${parseInt(user.id)} AND fecha = ${turno.fecha}::date
    `

    await logAudit({
      usuarioId: user.id,
      usuarioNombre: user.name,
      accion: 'PVN_TURNO_CERRADO',
      descripcion: `Cerró turno en ${turno.punto_venta_nombre} — ${resumen.total_pagos} pagos, total ${resumen.total_valor}`,
      datos: { punto_venta: turno.punto_venta_nombre, fecha: hoy, total_pagos: resumen.total_pagos, total_valor: resumen.total_valor, numero_recogida: numeroRecogida },
    })

    return NextResponse.json({ ok: true, total_pagos: resumen.total_pagos, total_valor: Number(resumen.total_valor) })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
