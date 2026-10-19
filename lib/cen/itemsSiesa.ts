// Ítems de venta de Siesa (API_v2_Items) guardados localmente para asignar el f120_id de
// cada producto de las órdenes. API_v2_Items no trae el código de barras, pero f120_notas
// guarda el código anterior del ítem (el mismo de "BD 2026"): por ahí se cruza.
import { sql } from '@/lib/db'
import { consultarTodo } from '@/lib/siesa/connekta'

const VIGENCIA_HORAS = 12

// "1806" · "127 - PRUEBA" → "127"
const codigoAnterior = (notas: unknown) => String(notas ?? '').trim().split(/[\s-]/)[0] || null

export async function actualizarItemsSiesa(): Promise<number> {
  const items = await consultarTodo<Record<string, unknown>>('API_v2_Items', undefined, 100)
  const venta = items.filter(i => Number(i.f120_ind_venta) === 1)
  if (!venta.length) return 0
  await sql`
    INSERT INTO cen_items_siesa (f120_id, referencia, descripcion, codigo_anterior, unidad, extension1, actualizado_at)
    SELECT id, ref, des, ant, und, ext, NOW() FROM unnest(
      ${venta.map(i => Number(i.f120_id))}::int[], ${venta.map(i => String(i.f120_referencia ?? '').trim())}::text[],
      ${venta.map(i => String(i.f120_descripcion ?? '').trim().slice(0, 200))}::text[], ${venta.map(i => codigoAnterior(i.f120_notas))}::text[],
      ${venta.map(i => String(i.f120_id_unidad_inventario ?? '').trim().slice(0, 4))}::text[],
      ${venta.map(i => String(i.f120_id_extension1 ?? '').trim().slice(0, 10) || null)}::text[]
    ) AS t(id, ref, des, ant, und, ext)
    ON CONFLICT (f120_id) DO UPDATE SET referencia = EXCLUDED.referencia, descripcion = EXCLUDED.descripcion,
      codigo_anterior = EXCLUDED.codigo_anterior, unidad = EXCLUDED.unidad, extension1 = EXCLUDED.extension1, actualizado_at = NOW()
  `
  await asignarItemsAutomaticamente()
  return venta.length
}

// Refresca la copia local solo si tiene más de 12 horas (o está vacía).
export async function actualizarItemsSiNecesario(): Promise<void> {
  const [r] = await sql`SELECT MAX(actualizado_at) AS ultima FROM cen_items_siesa`
  const vieja = !r?.ultima || Date.now() - new Date(r.ultima).getTime() > VIGENCIA_HORAS * 3600_000
  if (vieja) await actualizarItemsSiesa()
  else await asignarItemsAutomaticamente()
}

// Productos sin ítem de Siesa cuyo código anterior ("BD 2026") coincide con un único ítem.
export async function asignarItemsAutomaticamente(): Promise<number> {
  const r = await sql`
    UPDATE cen_productos p SET f120_id = x.f120_id, updated_at = NOW()
    FROM (
      SELECT codigo_anterior, MIN(f120_id) AS f120_id FROM cen_items_siesa
      WHERE codigo_anterior IS NOT NULL GROUP BY codigo_anterior HAVING COUNT(*) = 1
    ) x
    WHERE p.f120_id IS NULL AND p.item IS NOT NULL AND p.item = x.codigo_anterior
    RETURNING p.ean
  `
  return r.length
}
