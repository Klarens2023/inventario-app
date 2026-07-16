import type { CSSProperties } from 'react'
import type { Modo } from '@/types/acumulados'

export function modoStyle(m: Modo, modo: Modo): CSSProperties {
  return {
    padding: '7px 16px', borderRadius: 6,
    border: `2px solid ${modo === m ? '#0047BA' : 'var(--border)'}`,
    background: modo === m ? '#0047BA' : 'transparent',
    color: modo === m ? '#fff' : 'var(--text)',
    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s'
  }
}
