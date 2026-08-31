'use client'
import type { Turno } from '@/types/pvn-qr'
import { fmtFecha } from './utils'
import { btnDanger, btnSecondary } from './constants'

type Props = {
  turnoPendiente: Turno
  cerrando: boolean
  onCerrar: () => void
  onPreguntarQR: () => void
}

export function TurnoPendienteScreen({ turnoPendiente, cerrando, onCerrar, onPreguntarQR }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Turno pendiente</h2>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 6 }}>
            Tienes un turno sin cerrar del
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
            {fmtFecha(turnoPendiente.fecha)}
          </p>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
            Punto: <strong>{turnoPendiente.punto_venta_nombre}</strong>
          </p>
          <button
            onClick={onPreguntarQR}
            disabled={cerrando}
            style={{ ...btnSecondary, width: '100%', padding: '11px 0', fontSize: 13, marginBottom: 10 }}
          >
            ❓ ¿Tienes ventas QR de ese turno sin subir?
          </button>
          <button
            onClick={onCerrar}
            disabled={cerrando}
            style={{ ...btnDanger, width: '100%', padding: '13px 0', fontSize: 15, opacity: cerrando ? 0.7 : 1 }}
          >
            {cerrando ? 'Cerrando...' : '⏹ Cerrar turno pendiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
