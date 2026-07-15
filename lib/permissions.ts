export const MODULOS = [
  'cargar', 'consulta', 'acumulados',
  'pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr',
  'equipos', 'movimientos_tic',
  'planos',
] as const

export type Modulo = typeof MODULOS[number]

export const GRUPOS_MODULOS: Array<{ key: string; label: string; modulos: Modulo[] }> = [
  { key: 'logistica',    label: 'Logística',      modulos: ['cargar', 'consulta', 'acumulados'] },
  { key: 'puntos_venta', label: 'Puntos de Venta', modulos: ['pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr'] },
  { key: 'sistemas',     label: 'Sistemas',        modulos: ['equipos', 'movimientos_tic'] },
  { key: 'contabilidad', label: 'Contabilidad',    modulos: ['planos'] },
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
  movimientos_tic: 'Movimientos TIC',
  planos: 'Generación de Planos',
}

// Área tal como vive en la tabla `areas` (gestionable desde la UI de admin).
export type AreaInfo = {
  id: number
  key: string
  label: string
  color: string
  bg: string
  roles_permitidos: string[]
  modulos_usuario: string[]
  modulos_lider: string[]
  protegida: boolean
}

// Módulos asignados automáticamente al crear un usuario, según lo configurado
// en su área (tabla `areas`) — el admin puede ajustarlos libremente después
// desde el checklist de edición, y también puede cambiar el default por área
// desde "Áreas y Roles".
export function modulosPorDefecto(rol: string, area: AreaInfo | undefined): Modulo[] {
  if (rol === 'admin') return [...MODULOS]
  if (!area) return []
  return (rol === 'lider' ? area.modulos_lider : area.modulos_usuario) as Modulo[]
}

export function tieneModulo(rol: string, modulos: string[] | undefined, modulo: Modulo): boolean {
  if (rol === 'admin') return true
  return (modulos ?? []).includes(modulo)
}
