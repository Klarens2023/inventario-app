import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuthUser } from '@/lib/api-auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

const SELECT_PROD = `
  SELECT
    p.id,
    p.nombre,
    p.activo,
    COALESCE(
      json_agg(
        json_build_object(
          'componente_id', c.componente_id,
          'componente_nombre', c.componente_nombre,
          'cantidad', c.cantidad,
          'unidad', c.unidad
        ) ORDER BY c.componente_nombre
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'
    ) AS componentes
  FROM pvn_productos p
  LEFT JOIN pvn_componentes c ON c.producto_id = p.id
`

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const all = req.nextUrl.searchParams.get('all') === '1'

  const query = all
    ? `${SELECT_PROD} GROUP BY p.id, p.nombre, p.activo ORDER BY p.id`
    : `${SELECT_PROD} WHERE p.activo = true GROUP BY p.id, p.nombre, p.activo ORDER BY p.id`

  const rows = await sql(query, [])
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, modulos } = session.user
  if (!tieneModulo(rol, modulos, 'pvn_catalogo')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { nombre, componentes } = await req.json() as {
    nombre: string
    componentes?: Array<{ componente_nombre: string; cantidad: number; unidad: string; componente_id?: number }>
  }

  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const maxRow = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM pvn_productos`
  const [nuevo] = await sql`
    INSERT INTO pvn_productos (id, nombre) VALUES (${maxRow[0].next_id}, ${nombre.trim()})
    RETURNING id, nombre, activo
  `

  if (Array.isArray(componentes) && componentes.length > 0) {
    const maxCid = await sql`SELECT COALESCE(MAX(componente_id), 0) AS max FROM pvn_componentes`
    let counter = (maxCid[0].max as number) + 1
    for (const c of componentes) {
      if (!c.componente_nombre?.trim() || c.cantidad == null) continue
      const cid = c.componente_id ?? counter++
      await sql`
        INSERT INTO pvn_componentes (producto_id, componente_id, componente_nombre, cantidad, unidad)
        VALUES (${nuevo.id}, ${cid}, ${c.componente_nombre.trim()}, ${c.cantidad}, ${c.unidad ?? 'UND'})
      `
    }
  }

  return NextResponse.json(nuevo, { status: 201 })
}
