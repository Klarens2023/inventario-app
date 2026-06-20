import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rol, modulos } = session.user
  if (!tieneModulo(rol, modulos, 'pvn_analisis')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const productoId = searchParams.get('producto_id')
  const desde      = searchParams.get('desde')
  const hasta      = searchParams.get('hasta')
  const pvnId      = searchParams.get('punto_venta_id')

  if (!productoId || !desde || !hasta) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const pid      = parseInt(productoId)
  const pvnIdVal = pvnId ? parseInt(pvnId) : null

  const [info] = await sql(
    `SELECT nombre FROM pvn_productos WHERE id = $1`,
    [pid]
  )

  const [totales] = await sql(
    `SELECT COALESCE(SUM(d.cantidad), 0)::int AS total_vendido,
            COUNT(DISTINCT r.id)::int           AS en_registros
     FROM pvn_registros_detalle d
     JOIN pvn_registros r ON r.id = d.registro_id
     WHERE d.producto_id = $1
       AND r.fecha BETWEEN $2::date AND $3::date
       AND ($4::int IS NULL OR r.punto_venta_id = $4::int)`,
    [pid, desde, hasta, pvnIdVal]
  )

  const por_dia = await sql(
    `SELECT r.fecha::text AS fecha, SUM(d.cantidad)::int AS unidades
     FROM pvn_registros_detalle d
     JOIN pvn_registros r ON r.id = d.registro_id
     WHERE d.producto_id = $1
       AND r.fecha BETWEEN $2::date AND $3::date
       AND ($4::int IS NULL OR r.punto_venta_id = $4::int)
     GROUP BY r.fecha
     ORDER BY r.fecha ASC`,
    [pid, desde, hasta, pvnIdVal]
  )

  const por_turno = await sql(
    `SELECT r.turno, SUM(d.cantidad)::int AS unidades
     FROM pvn_registros_detalle d
     JOIN pvn_registros r ON r.id = d.registro_id
     WHERE d.producto_id = $1
       AND r.fecha BETWEEN $2::date AND $3::date
       AND ($4::int IS NULL OR r.punto_venta_id = $4::int)
     GROUP BY r.turno
     ORDER BY unidades DESC`,
    [pid, desde, hasta, pvnIdVal]
  )

  const componentes = await sql(
    `SELECT c.componente_nombre, c.unidad, c.cantidad AS por_unidad,
            ROUND((SUM(d.cantidad) * c.cantidad)::numeric, 4) AS total_consumido
     FROM pvn_registros_detalle d
     JOIN pvn_registros r ON r.id = d.registro_id
     JOIN pvn_componentes c ON c.producto_id = d.producto_id
     WHERE d.producto_id = $1
       AND r.fecha BETWEEN $2::date AND $3::date
       AND ($4::int IS NULL OR r.punto_venta_id = $4::int)
     GROUP BY c.componente_nombre, c.unidad, c.cantidad
     ORDER BY c.componente_nombre`,
    [pid, desde, hasta, pvnIdVal]
  )

  return NextResponse.json({
    producto_nombre: info?.nombre ?? '',
    total_vendido: totales?.total_vendido ?? 0,
    en_registros: totales?.en_registros ?? 0,
    por_dia,
    por_turno,
    componentes,
  })
}
