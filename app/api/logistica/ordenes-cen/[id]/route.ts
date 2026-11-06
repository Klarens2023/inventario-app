import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { recalcularRutas } from '@/lib/cen/rutas'
import { reversarPedido } from '@/lib/cen/pedidoSiesa'

// GET /api/logistica/ordenes-cen/[id] — detalle: líneas (con peso del maestro) y reparto por tienda
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const id = parseInt(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const [orden] = await sql`
    SELECT id, fuente, numero_orden, fecha_orden::text, fecha_entrega::text, fecha_entrega_max::text,
           ean_comprador, ean_entrega, nit, sucursal, razon_social,
           total_unidades::float AS total_unidades, valor_total::float AS valor_total, peso_kg::float AS peso_kg,
           ruta, ruta_manual, estado, created_at, siesa_consecutivo, siesa_respuesta, enviado_at, enviado_por,
           descartada_at, descartada_por, motivo_descarte
    FROM cen_ordenes WHERE id = ${id}
  `
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  const lineas = await sql`
    SELECT l.id, l.nro_linea, l.ean_item, l.cod_comprador, l.descripcion,
           l.cantidad::float AS cantidad, l.precio::float AS precio, l.iva::float AS iva,
           p.f120_id AS item_siesa, p.descripcion AS descripcion_maestro, p.peso_kg::float AS peso_kg, p.und_caja
    FROM cen_orden_lineas l
    LEFT JOIN cen_lineas_producto p ON p.linea_id = l.id -- producto de la cadena o del maestro
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

// PATCH /api/logistica/ordenes-cen/[id] — descartar (con motivo) / reactivar una orden, o cambiar su ruta
// (ruta vacía = volver a la ruta sugerida por las reglas)
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const id = parseInt(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const { accion, ruta, motivo } = await req.json() as { accion?: string; ruta?: string; motivo?: string }
  const [orden] = await sql`SELECT estado, nit FROM cen_ordenes WHERE id = ${id}`
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  // Reversar: la orden ya enviada vuelve a pendiente si su pedido está anulado en Siesa
  if (accion === 'reversar') {
    try {
      const r = await reversarPedido(id)
      return NextResponse.json(r.ok ? r : { error: r.mensaje }, { status: r.ok ? 200 : 409 })
    } catch (e) {
      return NextResponse.json({ error: `No se pudo consultar Siesa: ${e instanceof Error ? e.message : e}` }, { status: 502 })
    }
  }
  if (orden.estado === 'enviado') return NextResponse.json({ error: 'La orden ya se envió a Siesa' }, { status: 409 })

  if (accion === 'descartar') {
    // El motivo queda para el reporte de descartadas (quién, cuándo y por qué)
    const m = String(motivo ?? '').trim().slice(0, 300)
    if (!m) return NextResponse.json({ error: 'Indica el motivo del descarte' }, { status: 400 })
    await sql`UPDATE cen_ordenes SET estado = 'descartada', descartada_at = NOW(), descartada_por = ${acceso.user.name.slice(0, 120)},
                     motivo_descarte = ${m}, updated_at = NOW() WHERE id = ${id}`
  } else if (accion === 'reactivar') {
    await sql`UPDATE cen_ordenes SET estado = ${orden.nit ? 'pendiente' : 'sin_punto'}, descartada_at = NULL, descartada_por = NULL,
                     motivo_descarte = NULL, updated_at = NOW() WHERE id = ${id}`
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
