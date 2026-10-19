import type { EstadoOrdenCen } from '@/types/ordenes-cen'

export { codigoRelacion as relacion } from '@/lib/cen/relacion'

export const fmtMoneda = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

export const fmtNumero = (v: number, dec = 0) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: dec }).format(v)

// "2026-10-22" → "jue 22 oct"
export function fmtFecha(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

export const ESTADOS: Record<EstadoOrdenCen, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',     color: '#0047BA', bg: '#E0ECFF' },
  sin_punto:  { label: 'Por revisar',   color: '#B45309', bg: '#FEF3C7' },
  enviado:    { label: 'En Siesa',      color: '#047857', bg: '#D1FAE5' },
  error:      { label: 'Error Siesa',   color: '#B91C1C', bg: '#FEE2E2' },
  descartada: { label: 'Descartada',    color: '#475569', bg: '#E2E8F0' },
}
