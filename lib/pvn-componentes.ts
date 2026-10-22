import type { NeonQueryPromise } from '@neondatabase/serverless'
import { sql } from '@/lib/db'

export type ComponenteEntrada = { componente_nombre: string; cantidad: number; unidad: string; componente_id?: number }

/**
 * INSERT de los componentes (receta) de un producto PVN en una sola sentencia,
 * para usarlo dentro de `sql.transaction` junto con el alta/edición del producto
 * (AUD-22: antes era un INSERT por componente y un fallo dejaba la receta a medias).
 *
 * Regla que se conserva: el componente que trae `componente_id` lo mantiene; los
 * nuevos reciben MAX(componente_id) + 1, + 2… en el orden en que llegan. Se
 * omiten los que no tienen nombre o cantidad, como antes.
 *
 * @param productoId id del producto
 * @returns la consulta (sin ejecutar) o `null` si no hay componentes válidos
 */
export function qInsertarComponentes(productoId: number, componentes: ComponenteEntrada[] | undefined): NeonQueryPromise<false, false> | null {
  const validos = (componentes ?? []).filter(c => c.componente_nombre?.trim() && c.cantidad != null)
  if (validos.length === 0) return null
  let nuevos = 0
  const ord = validos.map(c => (c.componente_id == null ? ++nuevos : null))
  return sql`
    WITH base AS (SELECT COALESCE(MAX(componente_id), 0) AS m FROM pvn_componentes)
    INSERT INTO pvn_componentes (producto_id, componente_id, componente_nombre, cantidad, unidad)
    SELECT ${productoId}::int, COALESCE(c.cid, base.m + c.ord), c.nom, c.cant, c.uni
    FROM base, unnest(
      ${validos.map(c => c.componente_id ?? null)}::int[], ${ord}::int[],
      ${validos.map(c => c.componente_nombre.trim())}::text[], ${validos.map(c => c.cantidad)}::numeric[],
      ${validos.map(c => c.unidad ?? 'UND')}::text[]
    ) AS c(cid, ord, nom, cant, uni)
  `
}
