import type { AuditRow } from '@/types/auditoria'
import { ACCIONES } from './constants'

export function ResumenAcciones({ rows }: { rows: AuditRow[] }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {Object.entries(ACCIONES).map(([key, meta]) => {
        const count = rows.filter(r => r.accion === key).length
        return (
          <div key={key} style={{
            background: '#fff', borderRadius: 10, padding: '14px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              fontSize: 12, fontWeight: 600, color: meta.color, background: meta.bg
            }}>{meta.label}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{count}</span>
          </div>
        )
      })}
      <div style={{
        background: '#fff', borderRadius: 10, padding: '14px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12
      }}>
        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Total</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{rows.length}</span>
      </div>
    </div>
  )
}
