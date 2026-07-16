import type { AuditRow } from '@/types/auditoria'
import { ACCIONES } from './constants'

type Props = {
  rows: AuditRow[]
  loading: boolean
  onVerDetalle: (row: AuditRow) => void
}

export function TablaAuditoria({ rows, loading, onVerDetalle }: Props) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              {['Fecha y Hora', 'Usuario', 'Accion', 'Descripcion', 'Detalle'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontWeight: 700,
                  color: '#334155', fontSize: 13, whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  {loading ? 'Cargando...' : 'No hay registros para los filtros seleccionados'}
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const meta = ACCIONES[row.accion] ?? { label: row.accion, color: '#374151', bg: '#f3f4f6' }
              const fecha = new Date(row.created_at)
              return (
                <tr key={row.id} style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: i % 2 === 0 ? '#fff' : '#fafafa'
                }}>
                  <td style={{ padding: '11px 16px', whiteSpace: 'nowrap', color: '#475569' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.usuario_nombre}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.username}</div>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                      fontSize: 12, fontWeight: 600, color: meta.color, background: meta.bg,
                      whiteSpace: 'nowrap'
                    }}>{meta.label}</span>
                  </td>
                  <td style={{ padding: '11px 16px', color: '#475569', maxWidth: 320 }}>
                    {row.descripcion}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    {row.datos && (
                      <button
                        onClick={() => onVerDetalle(row)}
                        style={{
                          padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                          background: '#f8fafc', color: '#475569', fontSize: 12, cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Ver
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
