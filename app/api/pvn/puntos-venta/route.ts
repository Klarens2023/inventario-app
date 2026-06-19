import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'

function canManage(rol: string, area: string) {
  return rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area))
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tipo = req.nextUrl.searchParams.get('tipo')

  const rows = await sql(
    `SELECT pv.id, pv.nombre, pv.activo, pv.tipo,
            COUNT(u.id)::int AS usuarios_asignados
     FROM pvn_puntos_venta pv
     LEFT JOIN usuarios u ON u.punto_venta_id = pv.id AND u.activo = true
     WHERE ($1::text IS NULL OR pv.tipo = $1)
     GROUP BY pv.id, pv.nombre, pv.activo, pv.tipo
     ORDER BY pv.nombre`,
    [tipo]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, area } = user
  if (!canManage(rol, area)) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { nombre } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const dup = await sql`SELECT id FROM pvn_puntos_venta WHERE LOWER(nombre) = LOWER(${nombre.trim()}) LIMIT 1`
  if (dup.length > 0) return NextResponse.json({ error: 'Ya existe un punto de venta con ese nombre' }, { status: 409 })

  const [nuevo] = await sql`
    INSERT INTO pvn_puntos_venta (nombre) VALUES (${nombre.trim()})
    RETURNING id, nombre, activo
  `
  return NextResponse.json(nuevo, { status: 201 })
}
