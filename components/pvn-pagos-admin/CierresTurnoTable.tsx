'use client'
import type { CierreTurno } from '@/types/pvn-pagos-admin'
import { fmtFechaHora } from './utils'

type Props = {
  cierres: CierreTurno[]
  loading: boolean
  onSetLightbox: (url: string) => void
}

export function CierresTurnoTable({ cierres, loading, onSetLightbox }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      {!loading && cierres.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ width: 44, flexShrink: 0 }} />
          <div style={{ minWidth: 150, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cierre</div>
          <div style={{ width: 140, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Punto de venta</div>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Usuario</div>
          <div style={{ width: 120, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>N° recogida</div>
        </div>
      )}
      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
      {!loading && cierres.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay cierres de turno PVV en el período</div>
      )}
      {!loading && cierres.map(c => (
        <div
          key={c.id}
          style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14,
            borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          {c.foto_datafono_url ? (
            <img
              src={c.foto_datafono_url} alt="Cierre datafono" onClick={() => onSetLightbox(c.foto_datafono_url!)}
              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0, cursor: 'pointer' }}
            />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f1f5f9', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 150, fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
            {c.cerrado_at ? fmtFechaHora(c.cerrado_at) : '—'}
          </div>
          {c.punto_venta_nombre && (
            <span style={{ width: 140, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', whiteSpace: 'nowrap', boxSizing: 'border-box', display: 'inline-block', textAlign: 'center' }}>
              {c.punto_venta_nombre}
            </span>
          )}
          <div style={{ flex: 1, fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.usuario_nombre}
          </div>
          <div style={{ width: 120, fontSize: 14, fontWeight: 800, color: '#0f172a', textAlign: 'right', fontFamily: 'monospace' }}>
            {c.numero_recogida ?? '—'}
          </div>
        </div>
      ))}
    </div>
  )
}
