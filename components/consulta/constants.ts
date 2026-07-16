import type { CSSProperties } from 'react'
import type { Modo } from '@/types/consulta'

export const inputStyle: CSSProperties = {
  width: '100%', background: 'transparent', border: 'none',
  color: 'inherit', fontFamily: 'inherit', fontSize: 13,
  outline: 'none', padding: '2px 4px', cursor: 'text'
}

export const selStyle: CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  background: '#fff', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer'
}

export function btnGreenStyle(hayPendientes: boolean): CSSProperties {
  return {
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: hayPendientes ? '#9ca3af' : 'linear-gradient(135deg,#22c55e,#16a34a)',
    color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit'
  }
}

export function modoBtnStyle(m: Modo, modo: Modo): CSSProperties {
  return {
    padding: '7px 16px', borderRadius: 6,
    border: `2px solid ${modo === m ? '#0047BA' : '#d1d5db'}`,
    background: modo === m ? '#0047BA' : '#fff',
    color: modo === m ? '#fff' : '#374151',
    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit'
  }
}
