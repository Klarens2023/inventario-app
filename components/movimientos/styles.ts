import type { CSSProperties } from 'react'

export const inp: CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}

export const lbl: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: '#475569', marginBottom: 5, textTransform: 'uppercase',
}

export const btnPrimary: CSSProperties = {
  padding: '10px 20px', borderRadius: 10, border: 'none',
  background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}

export const btnSec: CSSProperties = {
  padding: '9px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
  background: '#fff', color: '#334155', fontWeight: 600, fontSize: 14, cursor: 'pointer',
}
