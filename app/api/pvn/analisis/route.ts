import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { hoyBogota } from '@/lib/fechas'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['pvn_analisis'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { rol, modulos } = user
  if (!tieneModulo(rol, modulos, 'pvn_analisis')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  // Fechas por defecto en hora de Colombia (antes en UTC: desde las 7 p. m. tomaba el día siguiente)
  const hoy    = hoyBogota()
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const desde  = searchParams.get('desde') ?? hace30
  const hasta  = searchParams.get('hasta') ?? hoy
  const pvnId  = searchParams.get('punto_venta_id')
  const pvnIdVal = pvnId ? parseInt(pvnId) : null

  const [summary] = await sql(
    `SELECT
       COUNT(DISTINCT r.id)::int          AS total_registros,
       COALESCE(SUM(d.cantidad), 0)::int  AS total_unidades,
       COUNT(DISTINCT d.producto_id)::int AS total_productos_distintos
     FROM pvn_registros r
     LEFT JOIN pvn_registros_detalle d ON d.registro_id = r.id
     WHERE r.fecha BETWEEN $1::date AND $2::date
       AND ($3::int IS NULL OR r.punto_venta_id = $3::int)`,
    [desde, hasta, pvnIdVal]
  )

  const productos = await sql(
    `SELECT d.producto_id, d.producto_nombre, SUM(d.cantidad)::int AS total_vendido
     FROM pvn_registros_detalle d
     JOIN pvn_registros r ON r.id = d.registro_id
     WHERE r.fecha BETWEEN $1::date AND $2::date
       AND ($3::int IS NULL OR r.punto_venta_id = $3::int)
     GROUP BY d.producto_id, d.producto_nombre
     ORDER BY total_vendido DESC`,
    [desde, hasta, pvnIdVal]
  )

  const ingredientes = await sql(
    `SELECT
       c.componente_nombre,
       c.unidad,
       SUM(d.cantidad * c.cantidad) AS total_consumido
     FROM pvn_registros_detalle d
     JOIN pvn_registros r ON r.id = d.registro_id
     JOIN pvn_componentes c ON c.producto_id = d.producto_id
     WHERE r.fecha BETWEEN $1::date AND $2::date
       AND ($3::int IS NULL OR r.punto_venta_id = $3::int)
     GROUP BY c.componente_nombre, c.unidad
     ORDER BY c.componente_nombre`,
    [desde, hasta, pvnIdVal]
  )

  const tendencia = await sql(
    `SELECT r.fecha::text, SUM(d.cantidad)::int AS total_unidades
     FROM pvn_registros r
     LEFT JOIN pvn_registros_detalle d ON d.registro_id = r.id
     WHERE r.fecha BETWEEN $1::date AND $2::date
       AND ($3::int IS NULL OR r.punto_venta_id = $3::int)
     GROUP BY r.fecha
     ORDER BY r.fecha ASC`,
    [desde, hasta, pvnIdVal]
  )

  return NextResponse.json({ summary, productos, ingredientes, tendencia })
}
