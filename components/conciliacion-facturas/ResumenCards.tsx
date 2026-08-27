'use client'
import type { ResumenProcesamiento } from '@/types/conciliacion-facturas'

type Props = { resumen: ResumenProcesamiento }

export function ResumenCards({ resumen }: Props) {
  const pct = (n: number) => resumen.totalInvoicing > 0 ? `${((n / resumen.totalInvoicing) * 100).toFixed(1)}%` : '—'

  const items = [
    { label: 'TOTAL RECIBIDAS', value: resumen.totalInvoicing, sub: `${resumen.totalRechazadas} rechazadas (excluidas)` },
    { label: 'CAUSADAS', value: resumen.causadas, sub: pct(resumen.causadas) },
    { label: 'NO CAUSADAS', value: resumen.noCausadas, sub: pct(resumen.noCausadas) },
    { label: 'REQUIEREN REVISIÓN', value: resumen.requierenRevision, sub: pct(resumen.requierenRevision) },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
      {items.map(it => (
        <div key={it.label} className="stat-card">
          <div className="stat-label">{it.label}</div>
          <div className="stat-value">{it.value.toLocaleString('es-CO')}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{it.sub}</div>
        </div>
      ))}
    </div>
  )
}
