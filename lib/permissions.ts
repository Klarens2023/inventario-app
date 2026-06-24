export const MODULOS = [
  'cargar', 'consulta', 'acumulados',
  'pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr',
  'equipos',
] as const

export type Modulo = typeof MODULOS[number]

export const GRUPOS_MODULOS: Array<{ key: string; label: string; modulos: Modulo[] }> = [
  { key: 'logistica',    label: 'Logística',      modulos: ['cargar', 'consulta', 'acumulados'] },
  { key: 'puntos_venta', label: 'Puntos de Venta', modulos: ['pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr'] },
  { key: 'sistemas',     label: 'Sistemas',        modulos: ['equipos'] },
]

export const MODULO_LABELS: Record<Modulo, string> = {
  cargar: 'Cargar Inventario',
  consulta: 'Conteo Físico',
  acumulados: 'Acumulados',
  pvn_historial: 'Historial PVN',
  pvn_analisis: 'Análisis PVN',
  pvn_catalogo: 'Catálogo PVN',
  pvn_pagos_qr: 'Pagos QR',
  equipos: 'Equipos TI',
}

const LOG: Modulo[] = ['cargar', 'consulta', 'acumulados']
const PV: Modulo[]  = ['pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr']
const SIS: Modulo[] = ['equipos']

// Módulos asignados automáticamente al crear un usuario — el admin puede
// ajustarlos libremente después desde el checklist de edición.
export function modulosPorDefecto(rol: string, area: string): Modulo[] {
  if (rol === 'admin') return [...MODULOS]
  if (area === 'logistica')    return rol === 'lider' ? [...LOG, ...PV] : [...LOG]
  if (area === 'sistemas')     return [...SIS]
  if (area === 'general')      return rol === 'lider' ? [...MODULOS] : [...LOG, ...PV, ...SIS]
  if (area === 'puntos_venta') return [...PV]
  return []
}

export function tieneModulo(rol: string, modulos: string[] | undefined, modulo: Modulo): boolean {
  if (rol === 'admin') return true
  return (modulos ?? []).includes(modulo)
}
