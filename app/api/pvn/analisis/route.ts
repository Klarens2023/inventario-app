import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, area } = session.user as { rol: string; area: string }
  if (rol !== 'admin' && !(rol === 'lider' && ['logistica', 'general'].includes(area))) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const hoy = new Date().toISOString().split('T')[0]
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const desde = searchParams.get('desde') ?? hace30
  const hasta = searchParams.get('hasta') ?? hoy

  const [summary] = await sql`
    SELECT
      COUNT(DISTINCT r.id)::int          AS total_registros,
      COALESCE(SUM(d.cantidad), 0)::int  AS total_unidades,
      COUNT(DISTINCT d.producto_id)::int AS total_productos_distintos
    FROM pvn_registros r
    LEFT JOIN pvn_registros_detalle d ON d.registro_id = r.id
    WHERE r.fecha BETWEEN ${desde}::date AND ${hasta}::date
  `

  const productos = await sql`
    SELECT d.producto_id, d.producto_nombre, SUM(d.cantidad)::int AS total_vendido
    FROM pvn_registros_detalle d
    JOIN pvn_registros r ON r.id = d.registro_id
    WHERE r.fecha BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY d.producto_id, d.producto_nombre
    ORDER BY total_vendido DESC
  `

  const ingredientes = await sql`
    SELECT
      c.componente_id,
      c.componente_nombre,
      c.unidad,
      SUM(d.cantidad * c.cantidad) AS total_consumido
    FROM pvn_registros_detalle d
    JOIN pvn_registros r ON r.id = d.registro_id
    JOIN pvn_componentes c ON c.producto_id = d.producto_id
    WHERE r.fecha BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY c.componente_id, c.componente_nombre, c.unidad
    ORDER BY c.componente_nombre
  `

  const tendencia = await sql`
    SELECT r.fecha::text, SUM(d.cantidad)::int AS total_unidades
    FROM pvn_registros r
    LEFT JOIN pvn_registros_detalle d ON d.registro_id = r.id
    WHERE r.fecha BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY r.fecha
    ORDER BY r.fecha ASC
  `

  return NextResponse.json({ summary, productos, ingredientes, tendencia })
}
