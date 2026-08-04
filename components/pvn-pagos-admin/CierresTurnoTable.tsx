'use client'
import { useState } from 'react'
import type { CierreTurno } from '@/types/pvn-pagos-admin'
import { fmtFechaHora, fmtFecha } from './utils'
import { Lightbox } from './Lightbox'

type Props = {
  cierres: CierreTurno[]
  loading: boolean
}

export function CierresTurnoTable({ cierres, loading }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Solo los cierres con foto entran al visor; el índice del lightbox se
  // maneja sobre esta lista filtrada, no sobre `cierres` completo.
  const conFoto = cierres.filter(c => !!c.foto_datafono_url)

  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      {!loading && cierres.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ width: 44, flexShrink: 0 }} />
          <div style={{ minWidth: 150, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Turno</div>
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
              src={`${c.foto_datafono_url}&thumb=1`} alt="Cierre datafono" onClick={() => setLightboxIndex(conFoto.findIndex(x => x.id === c.id))}
              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0, cursor: 'pointer' }}
            />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f1f5f9', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
              Turno {fmtFecha(c.fecha)}
            </div>
            <div style={{ fontSize: 11, color: c.fecha_cierre !== c.fecha ? '#b45309' : '#94a3b8', fontWeight: c.fecha_cierre !== c.fecha ? 600 : 400 }}>
              Cerrado {c.cerrado_at ? fmtFechaHora(c.cerrado_at) : '—'}
            </div>
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

      {lightboxIndex !== null && (
        <Lightbox
          items={conFoto.map(c => ({
            src: c.foto_datafono_url!,
            info: [
              { label: 'Fecha del turno', value: fmtFecha(c.fecha) },
              { label: 'Cerrado', value: c.cerrado_at ? fmtFechaHora(c.cerrado_at) : '' },
              { label: 'Punto de venta', value: c.punto_venta_nombre ?? '' },
              { label: 'Usuario', value: c.usuario_nombre },
              { label: 'N° recogida', value: c.numero_recogida ?? '' },
            ],
          }))}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
