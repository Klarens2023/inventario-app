import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'

// GET /api/logistica/ordenes-cen — órdenes con filtros (estado, fuente, comprador, fecha de entrega, búsqueda)
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const p = req.nextUrl.searchParams
  const estado = p.get('estado') ?? ''
  const fuente = p.get('fuente') ?? ''
  const comprador = p.get('comprador') ?? ''
  const desde = p.get('desde') || null
  const hasta = p.get('hasta') || null
  const buscar = (p.get('buscar') ?? '').trim()
  const ruta = p.get('ruta') ?? ''

  const rows = await sql`
    SELECT o.id, o.fuente, o.numero_orden, o.fecha_orden::text, o.fecha_entrega::text, o.fecha_entrega_max::text,
           o.ean_comprador, o.ean_entrega, o.nit, o.sucursal, o.razon_social,
           o.total_unidades::float AS total_unidades, o.valor_total::float AS valor_total, o.peso_kg::float AS peso_kg,
           o.ruta, o.ruta_manual, o.estado, o.created_at, o.siesa_consecutivo, pe.ciudad,
           (SELECT COUNT(*)::int FROM cen_orden_lineas l WHERE l.orden_id = o.id) AS lineas,
           (SELECT COUNT(DISTINCT d.ean_local)::int FROM cen_orden_distribucion d
              JOIN cen_orden_lineas l ON l.id = d.linea_id WHERE l.orden_id = o.id) AS locales,
           -- Motivos para revisar la orden antes de crear el pedido (solo órdenes abiertas)
           CASE WHEN o.estado IN ('pendiente', 'sin_punto', 'error') THEN array_remove(ARRAY[
             CASE WHEN o.nit IS NULL THEN 'Punto de entrega ' || o.ean_entrega || ' sin sucursal de Siesa asociada' END,
             CASE WHEN EXISTS (SELECT 1 FROM cen_orden_lineas l JOIN cen_lineas_producto p ON p.linea_id = l.id
                               WHERE l.orden_id = o.id AND p.ean IS NULL) THEN 'Productos que no están en el maestro (sin peso)' END,
             CASE WHEN EXISTS (SELECT 1 FROM cen_orden_lineas l JOIN cen_lineas_producto p ON p.linea_id = l.id
                               WHERE l.orden_id = o.id AND p.ean IS NOT NULL AND p.f120_id IS NULL) THEN 'Productos sin ítem de Siesa asignado' END
           ], NULL) ELSE '{}' END AS motivos
    FROM cen_ordenes o
    LEFT JOIN cen_puntos_ean pe ON pe.ean = o.ean_entrega
    WHERE (${estado} = '' OR o.estado = ${estado})
      AND (${fuente} = '' OR o.fuente = ${fuente})
      AND (${comprador} = '' OR o.ean_comprador = ${comprador})
      AND (${ruta} = '' OR (${ruta} = '-' AND o.ruta IS NULL) OR o.ruta = ${ruta})
      AND (${desde}::date IS NULL OR o.fecha_entrega >= ${desde}::date)
      AND (${hasta}::date IS NULL OR o.fecha_entrega <= ${hasta}::date)
      AND (${buscar} = '' OR o.numero_orden ILIKE ${'%' + buscar + '%'} OR o.razon_social ILIKE ${'%' + buscar + '%'}
           OR o.ean_entrega = ${buscar} OR o.nit = ${buscar})
    ORDER BY o.fecha_entrega NULLS LAST, o.razon_social NULLS FIRST, o.numero_orden
    LIMIT 2000
  `

  const [resumen] = await sql`
    SELECT COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
           COUNT(*) FILTER (WHERE estado = 'sin_punto')::int AS sin_punto,
           COUNT(*) FILTER (WHERE estado = 'enviado')::int AS enviadas,
           COUNT(*) FILTER (WHERE estado = 'error')::int AS con_error,
           (SELECT COUNT(*)::int FROM cen_archivos WHERE estado = 'error') AS archivos_error
    FROM cen_ordenes
  `

  return NextResponse.json({ ordenes: rows, resumen })
}
