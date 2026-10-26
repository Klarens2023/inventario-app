
export const CATEGORIAS_VALIDAS = ['Repuesto', 'Insumo', 'Periférico']
export const TIPOS_MOV_VALIDOS  = ['entrada', 'salida', 'ajuste']
export const DESTINOS_SALIDA    = ['equipo', 'persona', 'consumo']
export const DESTINOS_RETIRO    = ['inventario', 'baja', 'garantia', 'perdido']

// Motivo con el que queda en el kardex la entrada de un artículo que vuelve al inventario
export const MOTIVO_RETORNO: Record<string, string> = {
  reemplazo: 'Retirado por reemplazo',
  devolucion: 'Devolución de asignación',
}

// Única salida por consumo que no exige equipo
export const MOTIVO_BAJA = 'Baja por daño / vencimiento'

export function esFecha(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

// Postgres 42P01 = la tabla no existe: el módulo está desplegado pero falta correr la migración
export const MSG_FALTA_MIGRACION =
  'El módulo de Repuestos aún no tiene sus tablas en la base de datos. Hay que correr la migración scripts/migrate-add-tic-repuestos.js.'

export function faltaMigracion(e: unknown): boolean {
  return (e as { code?: string })?.code === '42P01'
}

// Entero >= 0 a partir de lo que llegue del formulario; null si no es válido
export function enteroNoNegativo(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function numeroOpcional(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function texto(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}
