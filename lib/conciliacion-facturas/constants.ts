import type { CSSProperties } from 'react'
import type { EstadoFactura, NivelCoincidencia } from '@/types/conciliacion-facturas'

export const NIVEL_LABELS: Record<NivelCoincidencia, string> = {
  exacta: 'Coincidencia exacta',
  equivalente: 'Equivalente (formato)',
  probable: 'Probable',
  documento_interno: 'Posible documento interno',
  no_encontrada: 'No encontrada',
}

// Colores tomados de las variables globales (globals.css): --accent2 (verde
// Klaren's) para causada, --danger para no causada, --warn para revisión.
export const ESTADO_INFO: Record<EstadoFactura, { label: string; color: string; bg: string }> = {
  CAUSADA: { label: 'Causada', color: '#00602A', bg: '#DFF5E6' },
  NO_CAUSADA: { label: 'No causada', color: '#B91C1C', bg: '#FEE2E2' },
  REQUIERE_REVISION: { label: 'Requiere revisión', color: '#92400E', bg: '#FEF3C7' },
}

export const labelStyle: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4,
}

export const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, color: 'var(--text)', background: '#fff', outline: 'none', boxSizing: 'border-box',
}

export const selectStyle: CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, color: 'var(--text)', background: '#fff', outline: 'none', cursor: 'pointer',
}

export function fmtMoneda(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const s = Math.abs(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })
  return (n < 0 ? '-$' : '$') + s
}

export const LOCAL_STORAGE_KEY_MAPEO = 'conciliacion-facturas:mapeo-columnas'
