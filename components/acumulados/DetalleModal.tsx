import type { Row } from '@/types/acumulados'
import { fmt, fmtFechaCorta } from './utils'

type Props = {
  detalle: Row
  esLotes: boolean
  onClose: () => void
}

export function DetalleModal({ detalle, esLotes, onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--bg)', width: '95%', maxWidth: 960, borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)' }}>
          <h2 style={{ fontSize: 14, margin: 0 }}>
            {detalle.descripcion}
            {esLotes && detalle.lote ? <span style={{ color: 'var(--text2)', marginLeft: 8 }}>| Lote: {detalle.lote}</span> : null}
            {' — '}{fmtFechaCorta(detalle.fecha)}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text)' }}>x</button>
        </div>
        <div style={{ padding: 20, overflowX: 'auto' }}>
          <table className="inv-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Referencia</th>
                {esLotes && <th>Lote</th>}
                <th>Descripcion</th><th>Loc.</th><th>U.M</th>
                <th>Fecha</th><th>Categoria</th><th>Subcategoria</th>
                <th>Conteo Fisico</th><th>Cant. Sistema</th><th>Diferencia</th>
                <th>Costo Unit.</th><th>Costo Dif.</th><th>Costo Bodega</th><th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">{detalle.referencia}</td>
                {esLotes && <td className="mono">{detalle.lote ?? '—'}</td>}
                <td>{detalle.descripcion}</td>
                <td>{detalle.localizacion}</td>
                <td>{detalle.um}</td>
                <td>{fmtFechaCorta(detalle.fecha)}</td>
                <td style={{ fontSize: 11, color: 'var(--text2)' }}>{detalle.categoria}</td>
                <td><span style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{detalle.tipo}</span></td>
                <td style={{ textAlign: 'right' }}>{Number(detalle.conteo_fisico).toLocaleString('es-CO')}</td>
                <td style={{ textAlign: 'right' }}>{Number(detalle.cantidad_sistema).toLocaleString('es-CO')}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }} className={Number(detalle.diferencia) < 0 ? 'neg' : 'pos'}>{Number(detalle.diferencia).toLocaleString('es-CO')}</td>
                <td style={{ textAlign: 'right' }}>{fmt(detalle.costo_unitario)}</td>
                <td style={{ textAlign: 'right' }} className={Number(detalle.costo_diferencia) < 0 ? 'neg' : ''}>{fmt(detalle.costo_diferencia)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(detalle.costo_bodega_total)}</td>
                <td style={{ color: 'var(--text2)' }}>{detalle.observaciones || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
