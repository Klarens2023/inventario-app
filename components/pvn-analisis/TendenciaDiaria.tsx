'use client'
import type { Tendencia } from '@/types/pvn-analisis'
import { fmtFechaCort } from './utils'

export function TendenciaDiaria({ tendencia }: { tendencia: Tendencia[] }) {
  const maxTendencia = Math.max(...(tendencia.map(t => Number(t.total_unidades)) ?? [1]), 1)

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
        Tendencia Diaria
      </div>
      {tendencia.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
      )}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 370, overflowY: 'auto' }}>
        {tendencia.map(t => {
          const barW = Math.round((Number(t.total_unidades) / maxTendencia) * 100)
          return (
            <div key={t.fecha} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#64748b', minWidth: 60, whiteSpace: 'nowrap' }}>{fmtFechaCort(t.fecha)}</span>
              <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barW}%`, background: '#6366f1', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', minWidth: 28, textAlign: 'right' }}>{t.total_unidades}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
