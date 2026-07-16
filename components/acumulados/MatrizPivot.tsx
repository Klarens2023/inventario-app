import type { PivotItem, Row } from '@/types/acumulados'

type Props = {
  loading: boolean
  hayFiltradas: boolean
  esLotes: boolean
  fechas: string[]
  items: PivotItem[]
  onSelectDetalle: (row: Row) => void
}

export function MatrizPivot({ loading, hayFiltradas, esLotes, fechas, items, onSelectDetalle }: Props) {
  return (
    <div style={{ overflow: 'auto', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando...</div>
      ) : !hayFiltradas ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Sin datos. Selecciona fechas y presiona Buscar.</div>
      ) : (
        <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg3)' }}>
            <tr>
              <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 100 }}>REFERENCIA</th>
              {esLotes && (
                <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 110 }}>LOTE</th>
              )}
              <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 220 }}>DESCRIPCION</th>
              <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'center', minWidth: 80 }}>CATEGORIA</th>
              <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'center', minWidth: 70 }}>SUBCATEGORIA</th>
              {fechas.map(f => (
                <th key={f} style={{ border: '1px solid var(--border)', padding: '6px 10px', minWidth: 90, textAlign: 'center', color: 'var(--accent)' }}>
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const rowKey = esLotes ? `${item.referencia}|${item.lote ?? ''}` : item.referencia
              return (
                <tr key={rowKey} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ border: '1px solid var(--border)', padding: '4px 10px', fontWeight: 600, fontFamily: 'monospace' }}>{item.referencia}</td>
                  {esLotes && (
                    <td style={{ border: '1px solid var(--border)', padding: '4px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)' }}>
                      {item.lote ?? '—'}
                    </td>
                  )}
                  <td style={{ border: '1px solid var(--border)', padding: '4px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>{item.descripcion}</td>
                  <td style={{ border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text2)' }}>{item.categoria}</td>
                  <td style={{ border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'center' }}>
                    <span style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{item.tipo}</span>
                  </td>
                  {fechas.map(f => {
                    const d   = item.datosPorFecha[f]
                    const dif = d ? Number(d.diferencia) : null
                    return (
                      <td key={f}
                        onClick={() => d && onSelectDetalle(d)}
                        style={{
                          border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'right',
                          cursor: d ? 'pointer' : 'default',
                          color: dif && dif < 0 ? 'var(--danger)' : dif && dif > 0 ? 'var(--accent)' : 'inherit'
                        }}
                        title={d ? 'Clic para ver detalles' : ''}>
                        {dif !== null && dif !== 0 ? dif.toLocaleString('es-CO') : (dif === 0 ? '0' : '')}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
