import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const rows = await sql`
    SELECT
      p.id,
      p.nombre,
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
    WHERE p.activo = true
    GROUP BY p.id, p.nombre
    ORDER BY p.id
  `
  return NextResponse.json(rows)
}
