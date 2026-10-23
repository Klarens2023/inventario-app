import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { getServerSession } from 'next-auth'
import { getAuthUser } from '@/lib/api-auth'
import type { NeonQueryPromise } from '@neondatabase/serverless'
import { sql } from '@/lib/db'
import { qInsertarComponentes } from '@/lib/pvn-componentes'
import { tieneModulo } from '@/lib/permissions'

// GET: cualquier usuario autenticado (el catálogo lo usan PVN, PVV y análisis).
// getAuthUser y no solo getServerSession: rechaza sesiones revocadas y con cambio
// de contraseña pendiente, que getServerSession por sí solo no filtra.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await exigirAcceso(req, { movil: true })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const id = parseInt(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
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

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await exigirAcceso(req, { modulos: ['pvn_catalogo'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { rol, modulos } = user
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

  // Nombre, estado y receta en una sola transacción (AUD-22): antes se borraba
  // la receta y se insertaba componente por componente; un fallo a mitad dejaba
  // el producto sin receta completa.
  const cambios: NeonQueryPromise<false, false>[] = []
  if (nombre !== undefined && nombre.trim()) {
    cambios.push(sql`UPDATE pvn_productos SET nombre = ${nombre.trim()} WHERE id = ${id}`)
  }
  if (activo !== undefined) {
    cambios.push(sql`UPDATE pvn_productos SET activo = ${!!activo} WHERE id = ${id}`)
  }
  if (componentes !== undefined) {
    cambios.push(sql`DELETE FROM pvn_componentes WHERE producto_id = ${id}`)
    const qComp = qInsertarComponentes(id, componentes)
    if (qComp) cambios.push(qComp)
  }
  if (cambios.length > 0) await sql.transaction(cambios)

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
