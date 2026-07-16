import type { AuditRow } from '@/types/auditoria'

type Props = {
  detalle: AuditRow
  onClose: () => void
}

export function DetalleModal({ detalle, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: '28px 32px',
          maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{detalle.descripcion}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {detalle.usuario_nombre} · {new Date(detalle.created_at).toLocaleString('es-CO')}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94a3b8', lineHeight: 1
          }}>×</button>
        </div>
        <pre style={{
          background: '#f8fafc', borderRadius: 8, padding: '16px', fontSize: 13,
          color: '#334155', overflow: 'auto', maxHeight: 260,
          border: '1px solid #e2e8f0', margin: 0
        }}>
          {JSON.stringify(detalle.datos, null, 2)}
        </pre>
      </div>
    </div>
  )
}
