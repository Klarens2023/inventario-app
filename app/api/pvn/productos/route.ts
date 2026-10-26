import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'
import { conReintentoPorDuplicado } from '@/lib/reintentar'
import { qInsertarComponentes } from '@/lib/pvn-componentes'

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
  const acceso = await exigirAcceso(req, { movil: true })
  if (!acceso.ok) return acceso.respuesta

  const all = req.nextUrl.searchParams.get('all') === '1'

  const query = all
    ? `${SELECT_PROD} GROUP BY p.id, p.nombre, p.activo ORDER BY p.id`
    : `${SELECT_PROD} WHERE p.activo = true GROUP BY p.id, p.nombre, p.activo ORDER BY p.id`

  const rows = await sql(query, [])
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['pvn_catalogo'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { rol, modulos } = user
  if (!tieneModulo(rol, modulos, 'pvn_catalogo')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { nombre, componentes } = await req.json() as {
    nombre: string
    componentes?: Array<{ componente_nombre: string; cantidad: number; unidad: string; componente_id?: number }>
  }

  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  // Producto y receta en una transacción (AUD-22); el id es "último + 1" y se
  // reintenta si otra alta simultánea tomó el mismo (AUD-21).
  const nuevo = await conReintentoPorDuplicado(async () => {
    const [{ next_id }] = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM pvn_productos`
    const qComp = qInsertarComponentes(next_id, componentes)
    const [filas] = await sql.transaction([
      sql`INSERT INTO pvn_productos (id, nombre) VALUES (${next_id}, ${nombre.trim()}) RETURNING id, nombre, activo`,
      ...(qComp ? [qComp] : []),
    ])
    return filas[0]
  })

  return NextResponse.json(nuevo, { status: 201 })
}
