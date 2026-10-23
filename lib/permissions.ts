// ════════════════════════════════════════════════════════════════════════════
// Permisos por módulo.
// Cada usuario tiene un rol (admin, lider, usuario, pvn, pvv) y una lista de
// módulos en la tabla usuario_modulos. El rol admin tiene todos los módulos.
// Las rutas API exigen módulos con exigirAcceso (lib/acceso.ts) y las páginas
// con middleware.ts; ambos usan tieneModulo().
// ════════════════════════════════════════════════════════════════════════════

/** Lista cerrada de módulos que existen; agregar uno nuevo empieza aquí. */
export const MODULOS = [
  'cargar', 'consulta', 'acumulados', 'ordenes_cen',
  'pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr',
  'equipos', 'movimientos_tic', 'repuestos_tic',
  'planos', 'conciliacion_facturas',
] as const

export type Modulo = typeof MODULOS[number]

/** Agrupación de módulos para el checklist de la pantalla de usuarios. */
export const GRUPOS_MODULOS: Array<{ key: string; label: string; modulos: Modulo[] }> = [
  { key: 'logistica',    label: 'Logística',      modulos: ['cargar', 'consulta', 'acumulados', 'ordenes_cen'] },
  { key: 'puntos_venta', label: 'Puntos de Venta', modulos: ['pvn_historial', 'pvn_analisis', 'pvn_catalogo', 'pvn_pagos_qr'] },
  { key: 'sistemas',     label: 'Sistemas',        modulos: ['equipos', 'movimientos_tic', 'repuestos_tic'] },
  { key: 'contabilidad', label: 'Contabilidad',    modulos: ['planos', 'conciliacion_facturas'] },
]

/** Nombre visible de cada módulo en la interfaz. */
export const MODULO_LABELS: Record<Modulo, string> = {
  cargar: 'Cargar Inventario',
  consulta: 'Conteo Físico',
  acumulados: 'Acumulados',
  ordenes_cen: 'Órdenes EDI (CEN)',
  pvn_historial: 'Historial PVN',
  pvn_analisis: 'Análisis PVN',
  pvn_catalogo: 'Catálogo PVN',
  pvn_pagos_qr: 'Pagos QR',
  equipos: 'Equipos TI',
  movimientos_tic: 'Movimientos TIC',
  repuestos_tic: 'Repuestos e Insumos',
  planos: 'Generación de Planos',
  conciliacion_facturas: 'Conciliación de Facturas',
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

/**
 * ¿El usuario puede usar este módulo? Regla única para páginas y API.
 * El admin siempre puede; el resto solo si lo tiene asignado.
 */
export function tieneModulo(rol: string, modulos: string[] | undefined, modulo: Modulo): boolean {
  if (rol === 'admin') return true
  return (modulos ?? []).includes(modulo)
}
