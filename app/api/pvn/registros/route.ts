import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

function canView(rol: string, area: string) {
  return rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area))
}

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

const SELECT_SQL = `
  SELECT r.id, r.fecha::text AS fecha, r.turno, r.usuario_nombre, r.observaciones, r.created_at,
         r.punto_venta_id, r.punto_venta_nombre,
         COALESCE(SUM(d.cantidad), 0)::int AS total_unidades,
         COUNT(d.id)::int AS total_productos,
         COALESCE(
           json_agg(
             json_build_object(
               'producto_id', d.producto_id,
               'producto_nombre', d.producto_nombre,
               'cantidad', d.cantidad
             ) ORDER BY d.producto_nombre
           ) FILTER (WHERE d.id IS NOT NULL),
           '[]'
         ) AS detalle
  FROM pvn_registros r
  LEFT JOIN pvn_registros_detalle d ON d.registro_id = r.id
`

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, area } = session.user as { rol: string; area: string }
  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta  = searchParams.get('hasta')
  const pvnId  = searchParams.get('punto_venta_id')

  if (rol === 'pvn') {
    const rows = await sql(
      `${SELECT_SQL}
       WHERE r.usuario_id = $1
       GROUP BY r.id
       ORDER BY r.fecha DESC, r.created_at DESC
       LIMIT 30`,
      [parseInt(session.user.id)]
    )
    return NextResponse.json(rows)
  }

  if (!canView(rol, area)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const desdeVal    = desde ?? null
  const hastaVal    = hasta ?? null
  const pvnIdVal    = pvnId ? parseInt(pvnId) : null
  const hasDateRange = !!(desde && hasta)

  const rows = await sql(
    `${SELECT_SQL}
     WHERE ($1::date IS NULL OR r.fecha >= $1::date)
       AND ($2::date IS NULL OR r.fecha <= $2::date)
       AND ($3::int IS NULL OR r.punto_venta_id = $3::int)
     GROUP BY r.id
     ORDER BY r.fecha DESC, r.created_at DESC
     ${hasDateRange ? '' : 'LIMIT 100'}`,
    [desdeVal, hastaVal, pvnIdVal]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol } = session.user as { rol: string }
  if (!['pvn', 'admin', 'lider'].includes(rol)) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const body = await req.json()
  const { fecha, turno, observaciones, detalle } = body as {
    fecha?: string
    turno: string
    observaciones?: string
    detalle: Array<{ producto_id: number; producto_nombre: string; cantidad: number }>
  }

  if (!turno) return NextResponse.json({ error: 'El turno es obligatorio' }, { status: 400 })
  const items = (detalle ?? []).filter(d => d.cantidad > 0)
  if (items.length === 0) return NextResponse.json({ error: 'Registra al menos un producto vendido' }, { status: 400 })

  const hoy = hoyBogota()
  // pvn solo puede registrar el día en curso (hora Colombia)
  if (rol === 'pvn' && fecha && fecha !== hoy) {
    return NextResponse.json({ error: `Solo puedes registrar ventas del día de hoy (${hoy})` }, { status: 400 })
  }
  const fechaFinal = rol === 'pvn' ? hoy : (fecha ?? hoy)

  const dup = await sql`
    SELECT id FROM pvn_registros
    WHERE usuario_id = ${parseInt(session.user.id)}
      AND fecha = ${fechaFinal}::date AND turno = ${turno}
    LIMIT 1
  `
  if (dup.length > 0) {
    return NextResponse.json({ error: `Ya existe un registro para el ${fechaFinal} en el turno ${turno}` }, { status: 409 })
  }

  const [userInfo] = await sql`
    SELECT u.punto_venta_id, pv.nombre AS punto_venta_nombre
    FROM usuarios u
    LEFT JOIN pvn_puntos_venta pv ON pv.id = u.punto_venta_id
    WHERE u.id = ${parseInt(session.user.id)}
    LIMIT 1
  `

  const [registro] = await sql`
    INSERT INTO pvn_registros (usuario_id, usuario_nombre, fecha, turno, observaciones, punto_venta_id, punto_venta_nombre)
    VALUES (
      ${parseInt(session.user.id)},
      ${session.user.name ?? session.user.email ?? 'PVN'},
      ${fechaFinal}::date,
      ${turno},
      ${observaciones ?? null},
      ${userInfo?.punto_venta_id ?? null},
      ${userInfo?.punto_venta_nombre ?? null}
    )
    RETURNING id
  `

  for (const item of items) {
    await sql`
      INSERT INTO pvn_registros_detalle (registro_id, producto_id, producto_nombre, cantidad)
      VALUES (${registro.id}, ${item.producto_id}, ${item.producto_nombre}, ${item.cantidad})
    `
  }

  await logAudit({
    usuarioId: session.user.id ?? null,
    usuarioNombre: session.user.name ?? 'PVN',
    accion: 'PVN_REGISTRO_CREADO',
    descripcion: `Registró ventas del ${fechaFinal} (${turno}) — ${items.length} productos, ${items.reduce((s, d) => s + d.cantidad, 0)} unidades`,
    datos: { fecha: fechaFinal, turno, productos: items.length, punto_venta: userInfo?.punto_venta_nombre },
  })

  return NextResponse.json({ id: registro.id }, { status: 201 })
}
