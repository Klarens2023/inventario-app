'use client'
import type { MovimientoResumen, FiltrosMovimientos } from '@/types/movimientos'
import { fetchMovimientoDetalle } from '@/lib/api/movimientos'
import { imprimirMovimiento } from './imprimirMovimiento'
import { Badge } from './shared'
import { inp, btnPrimary, btnSec } from './styles'

type Props = {
  lista: MovimientoResumen[]
  cargando: boolean
  filtros: FiltrosMovimientos
  onFiltro: (f: Partial<FiltrosMovimientos>) => void
  onBuscar: () => void
  onNuevo: () => void
  onVerDetalle: (id: string) => void
}

export function MovimientosList({ lista, cargando, filtros, onFiltro, onBuscar, onNuevo, onVerDetalle }: Props) {
  async function handleImprimir(id: string) {
    const det = await fetchMovimientoDetalle(id)
    imprimirMovimiento(det, window.location.origin)
  }

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Movimientos TIC</h1>
        <button onClick={onNuevo} style={btnPrimary}>+ Nuevo movimiento</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <input
          value={filtros.buscar}
          onChange={e => onFiltro({ buscar: e.target.value })}
          placeholder="Buscar por ID, nombre, tipo..."
          style={{ ...inp, maxWidth: 260, flex: 1 }}
        />
        <select value={filtros.estado} onChange={e => onFiltro({ estado: e.target.value })} style={{ ...inp, maxWidth: 160 }}>
          <option value="">Todos los estados</option>
          <option value="autorizado">Autorizado</option>
          <option value="entregado">Entregado</option>
          <option value="recibido">Recibido</option>
          <option value="cerrado">Cerrado</option>
        </select>
        <input type="date" value={filtros.desde} onChange={e => onFiltro({ desde: e.target.value })} style={{ ...inp, maxWidth: 160 }} />
        <input type="date" value={filtros.hasta} onChange={e => onFiltro({ hasta: e.target.value })} style={{ ...inp, maxWidth: 160 }} />
        <button onClick={onBuscar} style={btnSec}>Buscar</button>
      </div>

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Sin movimientos registrados</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Consecutivo', 'Fecha', 'Tipo', 'Origen', 'Destino', 'Activos', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0047BA', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{m.id}</td>
                    <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{m.fecha}</td>
                    <td style={{ padding: '12px 14px', color: '#334155', maxWidth: 180 }}>{m.tipo_movimiento}</td>
                    <td style={{ padding: '12px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                      {m.origen_nombre} <span style={{ color: '#94a3b8', fontSize: 11 }}>({m.origen_area})</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155', whiteSpace: 'nowrap' }}>
                      {m.destino_nombre} <span style={{ color: '#94a3b8', fontSize: 11 }}>({m.destino_area})</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#475569' }}>{m.total_activos}</td>
                    <td style={{ padding: '12px 14px' }}><Badge estado={m.estado} /></td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => onVerDetalle(m.id)} style={{ ...btnSec, fontSize: 12, padding: '4px 12px' }}>Ver</button>
                        <button onClick={() => handleImprimir(m.id)} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }} title="Imprimir">🖨️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
