// Maestro de productos de las órdenes EDI (cen_productos): código de barras (EAN) →
// ítem de Siesa, peso por unidad y unidades por caja. Lo usan la pantalla
// /logistica/ordenes-cen/productos y la vista previa del pedido (asignar el ítem a un
// código de barras nuevo sin salir de la orden: queda guardado para las siguientes).
import { sql } from '@/lib/db'

/**
 * Asigna el ítem de Siesa a un código de barras. Si el EAN no está en el maestro, lo crea
 * con la descripción con que llegó en la orden. Solo cambia el peso si se envía uno (no
 * borra el peso ni las unidades por caja que ya tenía, a diferencia del formulario completo).
 */
export async function asignarItemProducto(ean: string, f120Id: number, pesoKg: number | null) {
  await sql`
    INSERT INTO cen_productos (ean, f120_id, descripcion, peso_kg)
    VALUES (${ean}, ${f120Id},
            (SELECT descripcion FROM cen_orden_lineas WHERE ean_item = ${ean} AND descripcion <> '' ORDER BY id DESC LIMIT 1),
            ${pesoKg ?? 0})
    ON CONFLICT (ean) DO UPDATE SET f120_id = EXCLUDED.f120_id,
      peso_kg = CASE WHEN ${pesoKg}::numeric IS NULL THEN cen_productos.peso_kg ELSE EXCLUDED.peso_kg END,
      updated_at = NOW()
  `
  await recalcularPesoOrdenes(ean)
}

/**
 * Recalcula el peso de las órdenes abiertas que traen ese producto (queda vacío si algún
 * producto no tiene peso). Las líneas pedidas en kilos ya traen su peso (ver lib/cen/totales.ts).
 */
export async function recalcularPesoOrdenes(ean: string) {
  await sql`
    UPDATE cen_ordenes o SET peso_kg = x.peso, updated_at = NOW()
    FROM (
      SELECT l.orden_id,
        CASE WHEN BOOL_AND(p.ean IS NOT NULL OR COALESCE(to_jsonb(l) ->> 'unidad', 'UND') = 'KG')
          THEN SUM(CASE WHEN COALESCE(to_jsonb(l) ->> 'unidad', 'UND') = 'KG' THEN l.cantidad ELSE l.cantidad * p.peso_kg END) END AS peso
      FROM cen_orden_lineas l JOIN cen_lineas_producto p ON p.linea_id = l.id
      WHERE l.orden_id IN (SELECT orden_id FROM cen_orden_lineas WHERE ean_item = ${ean})
      GROUP BY l.orden_id
    ) x
    -- Las enviadas no se tocan, salvo los pedidos institucionales (su peso solo sirve para rutas y reportes)
    WHERE o.id = x.orden_id AND (o.estado <> 'enviado' OR o.fuente = 'institucional')
  `
}
