import type { CSSProperties } from 'react'

export const TURNOS = ['Mañana', 'Tarde', 'Noche', 'Cierre']

export const CAT_COLORS: Record<string, { border: string; header: string; text: string }> = {
  Helados:    { border: '#bfdbfe', header: '#eff6ff', text: '#1d4ed8' },
  Granizados: { border: '#d1fae5', header: '#f0fdf4', text: '#065f46' },
  Sundaes:    { border: '#ede9fe', header: '#f5f3ff', text: '#7c3aed' },
  Otros:      { border: '#fee2e2', header: '#fff5f5', text: '#b91c1c' },
}

export const lbl: CSSProperties  = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }
export const inp: CSSProperties  = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }
export const btnCount: CSSProperties = { width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, padding: 0, lineHeight: 1, flexShrink: 0 }
