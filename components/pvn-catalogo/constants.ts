import type { CSSProperties } from 'react'

export const UNIDADES = ['UND', 'KG', 'GRM', 'LT', 'ML']

export const lbl: CSSProperties       = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }
export const inp: CSSProperties       = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }
export const btnPrimary: CSSProperties   = { padding: '10px 22px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
export const btnSecondary: CSSProperties = { padding: '10px 22px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
export const btnEdit: CSSProperties  = { padding: '5px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
export const modalOverlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
export const modalBox: CSSProperties = { background: '#fff', borderRadius: 14, padding: '32px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }
export const modalTitle: CSSProperties = { fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 20 }
export const errBox: CSSProperties   = { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }
