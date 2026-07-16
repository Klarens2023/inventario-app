import type { CSSProperties } from 'react'

export const TURNO_STYLE: Record<string, { color: string; bg: string }> = {
  'Mañana': { color: '#92400e', bg: '#fef3c7' },
  'Tarde':  { color: '#1e3a5f', bg: '#dbeafe' },
  'Noche':  { color: '#4c1d95', bg: '#ede9fe' },
  'Cierre': { color: '#065f46', bg: '#d1fae5' },
}

export const lbl: CSSProperties        = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }
export const inp: CSSProperties        = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none' }
export const btnPrimary: CSSProperties = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
