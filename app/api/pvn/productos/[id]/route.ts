import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = parseInt(params.id)
  const [producto] = await sql`
    SELECT
      p.id, p.nombre, p.activo,
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
    WHERE p.id = ${id}
    GROUP BY p.id, p.nombre, p.activo
  `
  if (!producto) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  return NextResponse.json(producto)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, modulos } = session.user
  if (!tieneModulo(rol, modulos, 'pvn_catalogo')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const { nombre, activo, componentes } = await req.json() as {
    nombre?: string
    activo?: boolean
    componentes?: Array<{ componente_nombre: string; cantidad: number; unidad: string; componente_id?: number }>
  }

  if (nombre !== undefined && nombre.trim()) {
    await sql`UPDATE pvn_productos SET nombre = ${nombre.trim()} WHERE id = ${id}`
  }
  if (activo !== undefined) {
    await sql`UPDATE pvn_productos SET activo = ${!!activo} WHERE id = ${id}`
  }
  if (componentes !== undefined) {
    await sql`DELETE FROM pvn_componentes WHERE producto_id = ${id}`

    const [maxCid] = await sql`SELECT COALESCE(MAX(componente_id), 0) AS max FROM pvn_componentes`
    let counter = (maxCid.max as number) + 1
    for (const c of componentes) {
      if (!c.componente_nombre?.trim() || c.cantidad == null) continue
      const cid = c.componente_id ?? counter++
      await sql`
        INSERT INTO pvn_componentes (producto_id, componente_id, componente_nombre, cantidad, unidad)
        VALUES (${id}, ${cid}, ${c.componente_nombre.trim()}, ${c.cantidad}, ${c.unidad ?? 'UND'})
      `
    }
  }

  const [updated] = await sql`
    SELECT p.id, p.nombre, p.activo,
      COALESCE(
        json_agg(json_build_object(
          'componente_id', c.componente_id, 'componente_nombre', c.componente_nombre,
          'cantidad', c.cantidad, 'unidad', c.unidad
        ) ORDER BY c.componente_nombre) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) AS componentes
    FROM pvn_productos p
    LEFT JOIN pvn_componentes c ON c.producto_id = p.id
    WHERE p.id = ${id}
    GROUP BY p.id, p.nombre, p.activo
  `
  return NextResponse.json(updated)
}
