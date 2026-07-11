import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

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

  const { rol, modulos } = user
  if (!tieneModulo(rol, modulos, 'pvn_catalogo')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { nombre, tipo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!['nacional', 'principal'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido (nacional o principal)' }, { status: 400 })

  const dup = await sql`SELECT id FROM pvn_puntos_venta WHERE LOWER(nombre) = LOWER(${nombre.trim()}) LIMIT 1`
  if (dup.length > 0) return NextResponse.json({ error: 'Ya existe un punto de venta con ese nombre' }, { status: 409 })

  const [nuevo] = await sql`
    INSERT INTO pvn_puntos_venta (nombre, tipo) VALUES (${nombre.trim()}, ${tipo})
    RETURNING id, nombre, activo, tipo
  `
  return NextResponse.json(nuevo, { status: 201 })
}
