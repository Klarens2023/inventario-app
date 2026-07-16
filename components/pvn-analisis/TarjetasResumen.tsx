'use client'
import type { Summary } from '@/types/pvn-analisis'

export function TarjetasResumen({ summary }: { summary: Summary }) {
  const items = [
    { label: 'Registros en el período', value: summary.total_registros,           color: '#0047BA' },
    { label: 'Unidades vendidas',        value: summary.total_unidades,            color: '#065f46' },
    { label: 'Productos distintos',      value: summary.total_productos_distintos, color: '#7c3aed' },
  ]
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
