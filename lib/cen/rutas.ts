// Sugerencia de ruta de despacho para las órdenes EDI, según las reglas de
// cen_reglas_ruta (editables desde la app). Gana la primera regla, por
// prioridad, que cumpla cadena + ciudad/departamento + rango de peso.
// Una ruta asignada a mano (ruta_manual) nunca se recalcula.
import { sql } from '@/lib/db'

export interface ReglaRuta {
  id: number
  prioridad: number
  ruta: string
  ean_comprador: string | null
  ciudades: string[]
  departamentos: string[]
  peso_min: number | null
  peso_max: number | null
  descripcion: string | null
  activo: boolean
}

// "Bogotá, D.C." → "BOGOTA" · "Cartagena De Indias" → "CARTAGENA DE INDIAS"
export function normalizarLugar(s: string | null | undefined): string {
  return String(s ?? '').split(',')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// La ciudad de la regla coincide si es igual o es el inicio del nombre ("CARTAGENA" ↔ "CARTAGENA DE INDIAS").
const coincide = (lugar: string, lista: string[]) => lista.some(c => lugar === c || lugar.startsWith(c + ' '))

export function sugerirRuta(
  reglas: ReglaRuta[],
  o: { ean_comprador: string; ciudad: string | null; departamento: string | null; peso_kg: number | null },
): ReglaRuta | null {
  const ciudad = normalizarLugar(o.ciudad)
  const depto = normalizarLugar(o.departamento)
  // Sin punto homologado no se conoce la ciudad: no se sugiere ruta.
  if (!ciudad && !depto) return null
  for (const r of reglas) {
    if (!r.activo) continue
    if (r.ean_comprador && r.ean_comprador !== o.ean_comprador) continue
    const tieneLugar = r.ciudades.length > 0 || r.departamentos.length > 0
    if (tieneLugar && !(coincide(ciudad, r.ciudades) || coincide(depto, r.departamentos))) continue
    if (r.peso_min !== null && (o.peso_kg === null || o.peso_kg < r.peso_min)) continue
    if (r.peso_max !== null && (o.peso_kg === null || o.peso_kg > r.peso_max)) continue
    return r
  }
  return null
}

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
