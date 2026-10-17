import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { recalcularRutas } from '@/lib/cen/rutas'

// GET /api/logistica/ordenes-cen/[id] — detalle: líneas (con peso del maestro) y reparto por tienda
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const id = parseInt(params.id)
  const [orden] = await sql`
    SELECT id, fuente, numero_orden, fecha_orden::text, fecha_entrega::text, fecha_entrega_max::text,
           ean_comprador, ean_entrega, nit, sucursal, razon_social,
           total_unidades::float AS total_unidades, valor_total::float AS valor_total, peso_kg::float AS peso_kg,
           ruta, ruta_manual, estado, created_at, siesa_consecutivo, siesa_respuesta, enviado_at
    FROM cen_ordenes WHERE id = ${id}
  `
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  const lineas = await sql`
    SELECT l.id, l.nro_linea, l.ean_item, l.cod_comprador, l.descripcion,
           l.cantidad::float AS cantidad, l.precio::float AS precio, l.iva::float AS iva,
           p.item AS item_siesa, p.descripcion AS descripcion_maestro, p.peso_kg::float AS peso_kg, p.und_caja
    FROM cen_orden_lineas l
    LEFT JOIN cen_productos p ON p.ean = l.ean_item
    WHERE l.orden_id = ${id}
    ORDER BY l.nro_linea
  `

  // Reparto por tienda (órdenes entregadas en CEDI), con la tienda homologada si existe en cen_puntos_ean.
  const distribucion = await sql`
    SELECT d.ean_local, d.cantidad::float AS cantidad, l.ean_item, pe.nit, pe.sucursal, pe.razon_social
    FROM cen_orden_distribucion d
    JOIN cen_orden_lineas l ON l.id = d.linea_id
    LEFT JOIN cen_puntos_ean pe ON pe.ean = d.ean_local
    WHERE l.orden_id = ${id}
    ORDER BY pe.razon_social NULLS LAST, d.ean_local, l.nro_linea
  `

  return NextResponse.json({ orden, lineas, distribucion })
}

// PATCH /api/logistica/ordenes-cen/[id] — descartar / reactivar una orden, o cambiar su ruta
// (ruta vacía = volver a la ruta sugerida por las reglas)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const id = parseInt(params.id)
  const { accion, ruta } = await req.json() as { accion?: string; ruta?: string }
  const [orden] = await sql`SELECT estado, nit FROM cen_ordenes WHERE id = ${id}`
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (orden.estado === 'enviado') return NextResponse.json({ error: 'La orden ya se envió a Siesa' }, { status: 409 })

  if (accion === 'descartar') {
    await sql`UPDATE cen_ordenes SET estado = 'descartada', updated_at = NOW() WHERE id = ${id}`
  } else if (accion === 'reactivar') {
    await sql`UPDATE cen_ordenes SET estado = ${orden.nit ? 'pendiente' : 'sin_punto'}, updated_at = NOW() WHERE id = ${id}`
  } else if (accion === 'ruta') {
    const nueva = (ruta ?? '').trim().toUpperCase().slice(0, 40)
    if (nueva) {
      await sql`UPDATE cen_ordenes SET ruta = ${nueva}, ruta_manual = TRUE, updated_at = NOW() WHERE id = ${id}`
    } else {
      await sql`UPDATE cen_ordenes SET ruta_manual = FALSE, updated_at = NOW() WHERE id = ${id}`
      await recalcularRutas()
    }
  } else {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
