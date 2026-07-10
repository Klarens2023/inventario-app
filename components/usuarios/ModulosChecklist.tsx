'use client'
import { GRUPOS_MODULOS, MODULO_LABELS, type Modulo } from '@/lib/permissions'
import { labelStyle } from './constants'

type Props = {
  seleccionados: string[]
  onToggle: (m: Modulo) => void
}

export function ModulosChecklist({ seleccionados, onToggle }: Props) {
  return (
    <div>
      <label style={labelStyle}>Módulos de acceso</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
        {GRUPOS_MODULOS.map(grupo => (
          <div key={grupo.key}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0047BA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {grupo.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {grupo.modulos.map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={seleccionados.includes(m)} onChange={() => onToggle(m)} style={{ cursor: 'pointer' }} />
                  {MODULO_LABELS[m]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
