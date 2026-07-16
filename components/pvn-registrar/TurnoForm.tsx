'use client'
import { lbl, inp, TURNOS } from './constants'

type Props = {
  fecha: string
  turno: string; onTurnoChange: (v: string) => void
  obs: string; onObsChange: (v: string) => void
}

export function TurnoForm({ fecha, turno, onTurnoChange, obs, onObsChange }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 150 }}>
        <label style={lbl}>Fecha</label>
        <div style={{ ...inp, background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📅</span>
          <span>{fecha}</span>
          <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>(hoy · Colombia)</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 150 }}>
        <label style={lbl}>Turno</label>
        <select value={turno} onChange={e => onTurnoChange(e.target.value)} style={inp}>
          {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ flex: 2, minWidth: 200 }}>
        <label style={lbl}>Observaciones</label>
        <input value={obs} onChange={e => onObsChange(e.target.value)} placeholder="Opcional..." style={inp} />
      </div>
    </div>
  )
}
