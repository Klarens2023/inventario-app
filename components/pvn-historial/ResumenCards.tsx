import type { Registro } from '@/types/pvn-historial'

export function ResumenCards({ registros }: { registros: Registro[] }) {
  const totalPeriodo = registros.reduce((s, r) => s + r.total_unidades, 0)
  const stats = [
    { label: 'Registros', value: registros.length },
    { label: 'Total unidades', value: totalPeriodo },
    { label: 'Puntos activos', value: new Set(registros.map(r => r.punto_venta_id).filter(Boolean)).size || '—' },
  ]
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
      {stats.map(({ label, value }) => (
        <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1, minWidth: 110 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0047BA' }}>{value}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
