import { normalizarLugar } from './rutas'

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
