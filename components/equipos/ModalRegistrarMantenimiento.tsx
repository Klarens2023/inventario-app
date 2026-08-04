'use client'
import React, { useState } from 'react'
import type { EquipoMantenimiento } from '@/types/equipos'

type Props = {
  equipo: EquipoMantenimiento
  guardando: boolean
  onClose: () => void
  onGuardar: (data: { fecha: string; realizado: boolean; tecnico: string; proxima_fecha: string; observaciones: string }) => void
}

export function ModalRegistrarMantenimiento({ equipo, guardando, onClose, onGuardar }: Props) {
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(hoy)
  const [realizado, setRealizado] = useState<boolean | null>(null)
  const [tecnico, setTecnico] = useState(equipo.tecnico_responsable ?? '')
  const [proximaFecha, setProximaFecha] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 460, width: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Registrar Mantenimiento</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>{equipo.id} — {equipo.marca} {equipo.modelo}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>¿Se realizó el mantenimiento? *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setRealizado(true)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: realizado === true ? '2px solid #16a34a' : '1px solid #e2e8f0', background: realizado === true ? '#dcfce7' : '#fff', color: realizado === true ? '#166534' : '#475569', fontWeight: 700, cursor: 'pointer' }}>
                ✓ Sí, se realizó
              </button>
              <button type="button" onClick={() => setRealizado(false)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: realizado === false ? '2px solid #dc2626' : '1px solid #e2e8f0', background: realizado === false ? '#fee2e2' : '#fff', color: realizado === false ? '#991b1b' : '#475569', fontWeight: 700, cursor: 'pointer' }}>
                ✗ No se realizó
              </button>
            </div>
          </div>

          <div>
            <label style={lbl}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Técnico Responsable</label>
            <input value={tecnico} onChange={e => setTecnico(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Próximo Mantenimiento Programado</label>
            <input type="date" value={proximaFecha} onChange={e => setProximaFecha(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>{realizado === false ? 'Motivo por el que no se realizó' : 'Observaciones'}</label>
            <input value={observaciones} onChange={e => setObservaciones(e.target.value)} style={inp}
              placeholder={realizado === false ? 'Ej: Equipo no disponible, se reprogramó' : ''} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button
            onClick={() => onGuardar({ fecha, realizado: realizado as boolean, tecnico, proxima_fecha: proximaFecha, observaciones })}
            disabled={guardando || realizado === null || !fecha}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (guardando || realizado === null || !fecha) ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
