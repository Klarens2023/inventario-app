import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

function canManage(rol: string, area: string) {
  return rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rows = await sql`
    SELECT pv.id, pv.nombre, pv.activo,
           COUNT(u.id)::int AS usuarios_asignados
    FROM pvn_puntos_venta pv
    LEFT JOIN usuarios u ON u.punto_venta_id = pv.id AND u.activo = true
    GROUP BY pv.id, pv.nombre, pv.activo
    ORDER BY pv.nombre
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, area } = session.user as { rol: string; area: string }
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
