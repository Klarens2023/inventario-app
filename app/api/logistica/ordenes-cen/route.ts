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
  // Fecha de la OC (la "Fecha del documento" del portal CEN), para cuadrar contra el portal
  const ocDesde = p.get('oc_desde') || null
  const ocHasta = p.get('oc_hasta') || null
  // 'oc': las OC más recientes primero; si no, por fecha de entrega
  const porOc = p.get('orden') === 'oc'

  const rows = await sql`
    SELECT o.id, o.fuente, o.numero_orden, o.fecha_orden::text, o.fecha_entrega::text, o.fecha_entrega_max::text,
           o.ean_comprador, o.ean_entrega, o.nit, o.sucursal, o.razon_social,
           o.total_unidades::float AS total_unidades, o.valor_total::float AS valor_total, o.peso_kg::float AS peso_kg,
           -- Despacho: fijado a mano o entrega − días de tránsito de la ruta (da la semana de la relación)
           COALESCE(o.fecha_despacho, COALESCE(o.fecha_entrega, o.fecha_entrega_max) - COALESCE(rt.dias_transito, 0))::text AS fecha_despacho,
           (o.fecha_despacho IS NOT NULL) AS despacho_manual, COALESCE(rt.dias_transito, 0) AS dias_transito,
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
    LEFT JOIN cen_rutas rt ON rt.ruta = o.ruta
    WHERE (${estado} = '' OR o.estado = ${estado})
      AND (${fuente} = '' OR o.fuente = ${fuente})
      AND (${comprador} = '' OR o.ean_comprador = ${comprador})
      AND (${ruta} = '' OR (${ruta} = '-' AND o.ruta IS NULL) OR o.ruta = ${ruta})
      AND (${desde}::date IS NULL OR o.fecha_entrega >= ${desde}::date)
      AND (${hasta}::date IS NULL OR o.fecha_entrega <= ${hasta}::date)
      AND (${ocDesde}::date IS NULL OR o.fecha_orden >= ${ocDesde}::date)
      AND (${ocHasta}::date IS NULL OR o.fecha_orden <= ${ocHasta}::date)
      AND (${buscar} = '' OR o.numero_orden ILIKE ${'%' + buscar + '%'} OR o.razon_social ILIKE ${'%' + buscar + '%'}
           OR o.ean_entrega = ${buscar} OR o.nit = ${buscar})
    ORDER BY
      CASE WHEN ${porOc} THEN o.fecha_orden END DESC NULLS LAST,
      CASE WHEN ${porOc} THEN o.created_at END DESC,
      o.fecha_entrega NULLS LAST, o.razon_social NULLS FIRST, o.numero_orden
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

  // Pedidos en Siesa que aún no se han avisado a facturación (botón "Avisar a facturación" de cada ruta).
  // Sin la migración del aviso (scripts/migrate-add-cen-aviso-facturacion.js) simplemente no hay ninguno.
  const sinAviso = await sql`SELECT id FROM cen_ordenes WHERE estado = 'enviado' AND aviso_facturacion_at IS NULL`
    .then(r => r.map(x => x.id as number)).catch(() => [] as number[])

  return NextResponse.json({ ordenes: rows, resumen, sin_aviso: sinAviso })
}
