// Sugerencia de ruta de despacho para las órdenes EDI, según las reglas de
// cen_reglas_ruta (editables desde la app). Gana la primera regla, por
// prioridad, que cumpla cadena + ciudad/departamento + rango de peso.
// También valida las reglas que se escriben en pantalla (validarRegla).
// Sin dependencias de servidor: lo usan lib/cen/rutas.ts (con la base), las rutas
// API de reglas y las pruebas (tests/edi-calculos.test.ts).

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
  // Sin punto homologado no se conoce la ciudad: solo aplican las reglas de una cadena sin lugar (ej. ARA, D1).
  const sinLugar = !ciudad && !depto
  for (const r of reglas) {
    if (!r.activo) continue
    if (r.ean_comprador && r.ean_comprador !== o.ean_comprador) continue
    const tieneLugar = r.ciudades.length > 0 || r.departamentos.length > 0
    if (sinLugar && (tieneLugar || !r.ean_comprador)) continue
    if (tieneLugar && !(coincide(ciudad, r.ciudades) || coincide(depto, r.departamentos))) continue
    if (r.peso_min !== null && (o.peso_kg === null || o.peso_kg < r.peso_min)) continue
    if (r.peso_max !== null && (o.peso_kg === null || o.peso_kg > r.peso_max)) continue
    return r
  }
  return null
}

// ── Validación de una regla escrita en pantalla (/logistica/ordenes-cen/reglas) ──
export interface ReglaEntrada {
  prioridad?: number
  ruta?: string
  ean_comprador?: string | null
  ciudades?: string[] | string
  departamentos?: string[] | string
  peso_min?: number | string | null
  peso_max?: number | string | null
  descripcion?: string | null
  activo?: boolean
}

// Lista escrita como "Barranquilla, Soledad" o como arreglo → ["BARRANQUILLA","SOLEDAD"]
function lista(v: string[] | string | undefined): string[] {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(/[,;\n]/)
  return Array.from(new Set(arr.map(normalizarLugar).filter(Boolean)))
}

function peso(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) throw new Error('El peso debe ser un número positivo')
  return n
}

export function validarRegla(b: ReglaEntrada) {
  const ruta = String(b.ruta ?? '').trim().toUpperCase()
  if (!ruta || ruta.length > 40) throw new Error('La ruta es obligatoria (máx. 40 caracteres)')
  const pesoMin = peso(b.peso_min), pesoMax = peso(b.peso_max)
  if (pesoMin !== null && pesoMax !== null && pesoMin > pesoMax) throw new Error('El peso mínimo no puede ser mayor que el máximo')
  return {
    prioridad: Math.round(Number(b.prioridad ?? 100)) || 100,
    ruta,
    ean_comprador: String(b.ean_comprador ?? '').trim() || null,
    ciudades: lista(b.ciudades),
    departamentos: lista(b.departamentos),
    peso_min: pesoMin,
    peso_max: pesoMax,
    descripcion: String(b.descripcion ?? '').trim().slice(0, 120) || null,
    activo: b.activo !== false,
  }
}
