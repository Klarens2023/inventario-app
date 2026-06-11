import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

function canView(rol: string, area: string) {
  return rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, area } = session.user as { rol: string; area: string }
  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  if (rol === 'pvn') {
    const rows = await sql`
      SELECT r.id, r.fecha, r.turno, r.usuario_nombre, r.observaciones, r.created_at,
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
      WHERE r.usuario_id = ${parseInt(session.user.id)}
      GROUP BY r.id
      ORDER BY r.fecha DESC, r.created_at DESC
      LIMIT 30
    `
    return NextResponse.json(rows)
  }

  if (!canView(rol, area)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const rows = desde && hasta
    ? await sql`
        SELECT r.id, r.fecha, r.turno, r.usuario_nombre, r.observaciones, r.created_at,
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
        WHERE r.fecha BETWEEN ${desde}::date AND ${hasta}::date
        GROUP BY r.id
        ORDER BY r.fecha DESC, r.created_at DESC
      `
    : await sql`
        SELECT r.id, r.fecha, r.turno, r.usuario_nombre, r.observaciones, r.created_at,
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
        GROUP BY r.id
        ORDER BY r.fecha DESC, r.created_at DESC
        LIMIT 100
      `

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

  const fechaFinal = fecha ?? new Date().toISOString().split('T')[0]

  const dup = await sql`
    SELECT id FROM pvn_registros
    WHERE usuario_id = ${parseInt(session.user.id)}
      AND fecha = ${fechaFinal}::date
      AND turno = ${turno}
    LIMIT 1
  `
  if (dup.length > 0) {
    return NextResponse.json({ error: `Ya existe un registro para el ${fechaFinal} en el turno ${turno}` }, { status: 409 })
  }

  const [registro] = await sql`
    INSERT INTO pvn_registros (usuario_id, usuario_nombre, fecha, turno, observaciones)
    VALUES (
      ${parseInt(session.user.id)},
      ${session.user.name ?? session.user.email ?? 'PVN'},
      ${fechaFinal}::date,
      ${turno},
      ${observaciones ?? null}
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
    datos: { fecha: fechaFinal, turno, productos: items.length },
  })

  return NextResponse.json({ id: registro.id }, { status: 201 })
}
