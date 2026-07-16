import { fmt } from './utils'

type Props = {
  esLotes: boolean
  itemsCount: number
  costoBodega: number
  costoDiferencia: number
  participacion: string
}

export function TotalesCards({ esLotes, itemsCount, costoBodega, costoDiferencia, participacion }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      <div className="stat-card"><div className="stat-label">{esLotes ? 'Registros (lote)' : 'Referencias'}</div><div className="stat-value">{itemsCount}</div></div>
      <div className="stat-card"><div className="stat-label">Costo Bodega</div><div className="stat-value" style={{ fontSize: 14 }}>{fmt(costoBodega)}</div></div>
      <div className="stat-card">
        <div className="stat-label">Costo Diferencia</div>
        <div className="stat-value" style={{ fontSize: 14, color: costoDiferencia < 0 ? 'var(--danger)' : 'var(--accent)' }}>
          {fmt(costoDiferencia)}
        </div>
      </div>
      <div className="stat-card"><div className="stat-label">Participacion</div><div className="stat-value" style={{ color: 'var(--warn)' }}>{participacion}</div></div>
    </div>
  )
}
