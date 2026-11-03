// Rutas de despacho de las órdenes EDI guardadas en la base. La regla para
// elegir la ruta (sin base) está en ./reglasRuta. Una ruta asignada a mano
// (ruta_manual) nunca se recalcula.
import { sql } from '@/lib/db'
import { sugerirRuta, type ReglaRuta } from './reglasRuta'

export { normalizarLugar, sugerirRuta, type ReglaRuta } from './reglasRuta'
export { codigoRelacion } from './relacion'

export async function cargarReglas(): Promise<ReglaRuta[]> {
  const rows = await sql`
    SELECT id, prioridad, ruta, ean_comprador, ciudades, departamentos,
           peso_min::float AS peso_min, peso_max::float AS peso_max, descripcion, activo
    FROM cen_reglas_ruta ORDER BY prioridad, id
  `
  return rows as unknown as ReglaRuta[]
}

// Recalcula la ruta sugerida de las órdenes abiertas que no tienen ruta manual.
export async function recalcularRutas(): Promise<number> {
  const reglas = await cargarReglas()
  const ordenes = await sql`
    SELECT o.id, o.ean_comprador, o.peso_kg::float AS peso_kg, o.ruta, p.ciudad, p.departamento
    FROM cen_ordenes o
    LEFT JOIN cen_puntos_ean p ON p.ean = o.ean_entrega
    WHERE o.ruta_manual = FALSE AND o.estado IN ('pendiente', 'sin_punto', 'error')
  `
  let cambios = 0
  for (const o of ordenes) {
    const ruta = sugerirRuta(reglas, o as never)?.ruta ?? null
    if (ruta !== o.ruta) {
      await sql`UPDATE cen_ordenes SET ruta = ${ruta}, updated_at = NOW() WHERE id = ${o.id}`
      cambios++
    }
  }
  return cambios
}
