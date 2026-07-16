'use client'
import { useState } from 'react'
import type { Registro } from '@/types/pvn-historial'
import { fmtFecha, limpiar } from './utils'
import { TURNO_STYLE } from './constants'

type Props = {
  loading: boolean
  registros: Registro[]
}

export function RegistrosList({ loading, registros }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
      {!loading && registros.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay registros en el período</div>
      )}
      {!loading && registros.map(r => {
        const ts   = TURNO_STYLE[r.turno] ?? { color: '#374151', bg: '#f3f4f6' }
        const open = expanded === r.id
        return (
          <div key={r.id}>
            <div
              onClick={() => setExpanded(open ? null : r.id)}
              style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 10,
                borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                background: open ? '#f8fafc' : '#fff', transition: 'background 0.15s' }}
            >
              <div style={{ minWidth: 90, fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{fmtFecha(r.fecha)}</div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: ts.color, background: ts.bg, whiteSpace: 'nowrap' }}>
                {r.turno}
              </span>
              {r.punto_venta_nombre && (
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', whiteSpace: 'nowrap' }}>
                  {r.punto_venta_nombre}
                </span>
              )}
              <div style={{ flex: 1, fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.usuario_nombre}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                <strong style={{ color: '#0f172a' }}>{r.total_unidades}</strong> uds
                {' · '}
                <strong style={{ color: '#0f172a' }}>{r.total_productos}</strong> prod
              </div>
              <span style={{ fontSize: 16, color: '#94a3b8', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
            </div>

            {open && (
              <div style={{ background: '#f8fafc', padding: '10px 20px 14px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: r.observaciones ? 10 : 0 }}>
                  {r.detalle.map(d => (
                    <div key={d.producto_id} style={{ background: '#fff', borderRadius: 8, padding: '6px 14px', border: '1px solid #e2e8f0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#475569' }}>{limpiar(d.producto_nombre)}</span>
                      <span style={{ fontWeight: 800, color: '#0047BA', fontSize: 15 }}>{d.cantidad}</span>
                    </div>
                  ))}
                </div>
                {r.observaciones && (
                  <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>Obs: {r.observaciones}</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
