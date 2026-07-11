import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// GET /api/qr/turno — turno abierto hoy para el usuario autenticado
// Con ?pendiente=true también devuelve turno sin cerrar de días anteriores
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['pvn', 'pvv'].includes(user.rol)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const hoy = hoyBogota()
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

  const body = await req.json()
  const accion: string = body.accion

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
      const pvId = parseInt(body.punto_venta_id)
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
    const turnoId = body.turno_id ? parseInt(body.turno_id) : null

    const [turno] = turnoId
      ? await sql`
          UPDATE pvn_turnos
          SET activo = FALSE, cerrado_at = NOW()
          WHERE id = ${turnoId} AND usuario_id = ${parseInt(user.id)} AND activo = TRUE
          RETURNING id, punto_venta_nombre, fecha::text AS fecha
        `
      : await sql`
          UPDATE pvn_turnos
          SET activo = FALSE, cerrado_at = NOW()
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
      datos: { punto_venta: turno.punto_venta_nombre, fecha: hoy, total_pagos: resumen.total_pagos, total_valor: resumen.total_valor },
    })

    return NextResponse.json({ ok: true, total_pagos: resumen.total_pagos, total_valor: Number(resumen.total_valor) })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
