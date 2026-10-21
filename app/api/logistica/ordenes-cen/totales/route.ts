import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'

// GET /api/logistica/ordenes-cen/totales?ids=1,2,3&ruta=EXVAL — tabla de totales de una ruta, como las
// hojas de relación de "BD 2026": cantidades, valor y peso por punto de venta e ítem. La pantalla las
// agrupa por ítem o por cliente; "modo" es la vista por defecto de la ruta (cen_rutas).
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map(n => parseInt(n)).filter(n => n > 0)
  const ruta = req.nextUrl.searchParams.get('ruta') ?? ''
  if (!ids.length) return NextResponse.json({ modo: 'item', filas: [] })

  const filas = await sql`
    SELECT COALESCE(o.razon_social, 'Punto sin homologar · EAN ' || o.ean_entrega) AS punto, o.nit, o.sucursal,
           l.ean_item, p.f120_id, COALESCE(p.descripcion, MAX(l.descripcion)) AS descripcion,
           SUM(l.cantidad)::float AS cantidad, SUM(l.cantidad * l.precio)::float AS valor,
           CASE WHEN p.peso_kg IS NULL THEN NULL ELSE SUM(l.cantidad * p.peso_kg)::float END AS peso
    FROM cen_ordenes o
    JOIN cen_orden_lineas l ON l.orden_id = o.id
    JOIN cen_lineas_producto p ON p.linea_id = l.id -- producto de la cadena o del maestro
    WHERE o.id = ANY(${ids}) AND o.estado <> 'descartada'
    GROUP BY 1, o.nit, o.sucursal, l.ean_item, p.f120_id, p.descripcion, p.peso_kg
    ORDER BY 1, 6
  `
  const [r] = ruta ? await sql`SELECT totales FROM cen_rutas WHERE ruta = ${ruta}` : []
  return NextResponse.json({ modo: r?.totales ?? 'item', filas })
}

// PUT /api/logistica/ordenes-cen/totales — guarda la vista por defecto de la ruta. Body: { ruta, totales: 'item' | 'cliente' }
export async function PUT(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const { ruta, totales } = await req.json() as { ruta?: string; totales?: string }
  if (!ruta || !['item', 'cliente'].includes(totales ?? '')) return NextResponse.json({ error: 'Ruta o vista inválida' }, { status: 400 })
  await sql`
    INSERT INTO cen_rutas (ruta, totales) VALUES (${ruta}, ${totales!})
    ON CONFLICT (ruta) DO UPDATE SET totales = EXCLUDED.totales, updated_at = NOW()
  `
  return NextResponse.json({ ok: true })
}
