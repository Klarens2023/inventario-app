'use client'
import type { PagoAdmin } from '@/types/pvn-pagos-admin'
import { fmtMoneda } from './utils'

export function ResumenCards({ pagos }: { pagos: PagoAdmin[] }) {
  const totalValor = pagos.reduce((s, p) => s + Number(p.valor), 0)
  const items = [
    { label: 'Pagos', value: pagos.length },
    { label: 'Total recaudado', value: fmtMoneda(totalValor) },
    { label: 'Puntos activos', value: new Set(pagos.map(p => p.punto_venta_id).filter(Boolean)).size || '—' },
  ]
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
      {items.map(({ label, value }) => (
        <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0047BA' }}>{value}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
