'use client'
import type { TurnoActivo } from '@/types/pvn-pagos-admin'
import { btnDanger } from './constants'

type Props = {
  turnosActivos: TurnoActivo[]
  cargando: boolean
  mostrar: boolean
  onToggleMostrar: () => void
  cerrandoTurnoId: number | null
  onCerrarTurno: (t: TurnoActivo) => void
  puedeCerrar: boolean
}

export function TurnosActivosPanel({ turnosActivos, cargando, mostrar, onToggleMostrar, cerrandoTurnoId, onCerrarTurno, puedeCerrar }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20, overflow: 'hidden' }}>
      <button
        onClick={onToggleMostrar}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
          🕐 Turnos activos ahora {turnosActivos.length > 0 && `(${turnosActivos.length})`}
        </span>
        <span style={{ color: '#94a3b8', transform: mostrar ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {mostrar && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          {cargando && <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
          {!cargando && turnosActivos.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Nadie tiene un turno abierto ahora mismo</div>
          )}
          {!cargando && turnosActivos.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ minWidth: 160, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.usuario_nombre}</div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', whiteSpace: 'nowrap' }}>
                {t.punto_venta_nombre}
              </span>
              <div style={{ flex: 1, fontSize: 12, color: '#64748b' }}>
                Desde {new Date(t.abierto_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {puedeCerrar && (
                <button
                  onClick={() => onCerrarTurno(t)}
                  disabled={cerrandoTurnoId === t.id}
                  style={{ ...btnDanger, opacity: cerrandoTurnoId === t.id ? 0.6 : 1, cursor: cerrandoTurnoId === t.id ? 'not-allowed' : 'pointer' }}
                >
                  {cerrandoTurnoId === t.id ? 'Cerrando...' : '⏹ Cerrar turno'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
