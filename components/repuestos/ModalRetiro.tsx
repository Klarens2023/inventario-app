'use client'
import { useState } from 'react'
import type { Asignacion, DestinoRetiro } from '@/types/repuestos'
import { retirarAsignacion } from '@/lib/api/repuestos'
import { inp, lbl, btnPrimary, btnSec } from '@/components/movimientos/styles'
import { MOTIVOS_RETIRO, DESTINO_RETIRO_LABEL, fmtFechaCorta } from './constants'
import { Campo, Modal } from './shared'
import { imprimirAsignacion } from './imprimir'

type Props = {
  asignacion: Asignacion
  onClose: () => void
  onGuardado: () => void
}

export function ModalRetiro({ asignacion: a, onClose, onGuardado }: Props) {
  const hoy = new Date().toLocaleDateString('en-CA')
  const [fecha, setFecha] = useState(hoy)
  const [motivo, setMotivo] = useState(a.es_prestamo ? 'Fin del préstamo' : '')
  const [destino, setDestino] = useState<DestinoRetiro | ''>(a.es_prestamo ? 'inventario' : '')
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(false)

  const donde = a.equipo_id ? `${a.equipo_id}${a.persona_nombre ? ` · ${a.persona_nombre}` : ''}` : a.persona_nombre

  async function guardar() {
    setError('')
    if (!motivo || !destino) { setError('Indica el motivo y qué pasa con el artículo'); return }
    setGuardando(true)
    try {
      const res = await retirarAsignacion(a.id, { fecha, motivo, destino_retiro: destino, detalle })
      if (res.error) { setError(res.error); return }
      setHecho(true)
    } finally {
      setGuardando(false)
    }
  }

  if (hecho) return (
    <Modal titulo="Retiro registrado" subtitulo={`${a.articulo_codigo} — ${a.descripcion}`} onClose={onGuardado} ancho={440}>
      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#d1fae5', color: '#065f46', fontSize: 13, marginBottom: 16 }}>
        ✓ La asignación quedó cerrada{destino === 'inventario' ? ' y el artículo regresó al stock' : ''}.
      </div>
      <button style={{ ...btnSec, display: 'block', width: '100%', textAlign: 'left' }} onClick={() => imprimirAsignacion(a.id, 'retiro')}>
        🖨️ Acta de devolución / retiro
      </button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onGuardado} style={btnPrimary}>Cerrar</button>
      </div>
    </Modal>
  )

  return (
    <Modal titulo="Devolver / retirar asignación" subtitulo={`${a.articulo_codigo} — ${a.descripcion} (×${a.cantidad}) · ${donde}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
        Asignado el {fmtFechaCorta(a.fecha_asignacion)}
        {a.es_prestamo && <> · préstamo hasta <b style={{ color: a.vencido ? '#dc2626' : '#334155' }}>{fmtFechaCorta(a.fecha_limite_prestamo)}</b>{a.vencido ? ' (vencido)' : ''}</>}
        {a.observaciones && <div style={{ marginTop: 4 }}>Observación de entrega: {a.observaciones}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Campo label="Fecha *">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
        </Campo>
        <Campo label="Motivo *">
          <select value={motivo} onChange={e => setMotivo(e.target.value)} style={inp}>
            <option value="">Seleccionar...</option>
            {MOTIVOS_RETIRO.map(m => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lbl}>¿Qué pasa con el artículo? *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {(Object.keys(DESTINO_RETIRO_LABEL) as DestinoRetiro[]).map(k => (
              <button key={k} type="button" onClick={() => setDestino(k)} style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, textAlign: 'left',
                border: destino === k ? '2px solid #0047BA' : '1px solid #e2e8f0',
                background: destino === k ? '#eff6ff' : '#fff', color: destino === k ? '#0047BA' : '#475569',
              }}>
                {DESTINO_RETIRO_LABEL[k]}
              </button>
            ))}
          </div>
          {destino === 'inventario' && (
            <div style={{ fontSize: 12, color: '#065f46', marginTop: 6 }}>Se sumará {a.cantidad} al stock con una entrada en el kardex.</div>
          )}
        </div>
        <Campo label="Detalle / estado en que se recibe" span={2}>
          <textarea value={detalle} onChange={e => setDetalle(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        </Campo>
      </div>

      {error && <div style={{ marginTop: 14, padding: '9px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando...' : 'Registrar retiro'}
        </button>
      </div>
    </Modal>
  )
}
