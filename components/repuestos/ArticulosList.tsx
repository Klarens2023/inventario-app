'use client'
import type { Articulo, FiltrosArticulos, TipoMovArticulo } from '@/types/repuestos'
import { inp, btnPrimary, btnSec } from '@/components/movimientos/styles'
import { CATEGORIAS, CATEGORIA_COLOR, nivelStock } from './constants'
import { Chip, StockBadge, fmtPesos } from './shared'

type Props = {
  lista: Articulo[]
  cargando: boolean
  filtros: FiltrosArticulos
  onFiltro: (f: Partial<FiltrosArticulos>) => void
  onNuevo: () => void
  onEditar: (a: Articulo) => void
  onMovimiento: (a: Articulo, tipo: TipoMovArticulo) => void
  onKardex: (a: Articulo) => void
  onActivar: (a: Articulo, activo: boolean) => void
}

function Resumen({ titulo, valor, color, onClick, activo }: { titulo: string; valor: string | number; color: string; onClick?: () => void; activo?: boolean }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px', flex: '1 1 160px',
      border: activo ? `2px solid ${color}` : '1px solid #e2e8f0', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{valor}</div>
    </div>
  )
}

export function ArticulosList({ lista, cargando, filtros, onFiltro, onNuevo, onEditar, onMovimiento, onKardex, onActivar }: Props) {
  const activos  = lista.filter(a => a.activo)
  const bajos    = activos.filter(a => nivelStock(a.stock_actual, a.stock_minimo) === 'bajo').length
  const agotados = activos.filter(a => a.stock_actual === 0).length
  const valor    = activos.reduce((s, a) => s + (a.costo_unitario ? Number(a.costo_unitario) * a.stock_actual : 0), 0)

  const btnMini = { ...btnSec, fontSize: 12, padding: '4px 10px' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Resumen titulo="Artículos" valor={activos.length} color="#0047BA" />
        <Resumen titulo="Bajo el mínimo" valor={bajos} color="#d97706"
          activo={filtros.stock === 'bajo'} onClick={() => onFiltro({ stock: filtros.stock === 'bajo' ? '' : 'bajo' })} />
        <Resumen titulo="Agotados" valor={agotados} color="#dc2626"
          activo={filtros.stock === 'agotado'} onClick={() => onFiltro({ stock: filtros.stock === 'agotado' ? '' : 'agotado' })} />
        <Resumen titulo="Valor en bodega" valor={fmtPesos(valor)} color="#065f46" />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input value={filtros.buscar} onChange={e => onFiltro({ buscar: e.target.value })}
          placeholder="Buscar por código, descripción, referencia, compatibilidad..." style={{ ...inp, maxWidth: 340, flex: 1 }} />
        <select value={filtros.categoria} onChange={e => onFiltro({ categoria: e.target.value })} style={{ ...inp, maxWidth: 170 }}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filtros.stock} onChange={e => onFiltro({ stock: e.target.value as FiltrosArticulos['stock'] })} style={{ ...inp, maxWidth: 170 }}>
          <option value="">Todo el stock</option>
          <option value="bajo">Bajo el mínimo</option>
          <option value="agotado">Agotados</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
          <input type="checkbox" checked={filtros.inactivos} onChange={e => onFiltro({ inactivos: e.target.checked })} />
          Ver inactivos
        </label>
        <div style={{ flex: 1 }} />
        <button onClick={onNuevo} style={btnPrimary}>+ Nuevo artículo</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Sin artículos con esos filtros</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Código', 'Categoría', 'Artículo', 'Compatible con', 'Ubicación', 'Stock', 'Mín.', 'Movimiento', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(a => {
                  const cc = CATEGORIA_COLOR[a.categoria]
                  return (
                    <tr key={a.codigo} style={{ borderTop: '1px solid #f1f5f9', opacity: a.activo ? 1 : 0.55 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0047BA', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{a.codigo}</td>
                      <td style={{ padding: '10px 14px' }}><Chip texto={a.categoria} {...cc} /></td>
                      <td style={{ padding: '10px 14px', color: '#1e293b', minWidth: 220 }}>
                        <div style={{ fontWeight: 600 }}>{a.descripcion}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {a.tipo}{a.marca ? ` · ${a.marca}` : ''}{a.referencia ? ` · ${a.referencia}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', maxWidth: 220, fontSize: 12 }}>{a.compatible_con ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', fontSize: 12 }}>{a.ubicacion ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}><StockBadge actual={a.stock_actual} minimo={a.stock_minimo} unidad={a.unidad} /></td>
                      <td style={{ padding: '10px 14px', color: '#64748b', textAlign: 'center' }}>{a.stock_minimo || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {a.activo && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => onMovimiento(a, 'entrada')} style={{ ...btnMini, color: '#065f46' }} title="Entrada">+ Entrada</button>
                            <button onClick={() => onMovimiento(a, 'salida')} disabled={a.stock_actual === 0}
                              style={{ ...btnMini, color: '#9a3412', opacity: a.stock_actual === 0 ? 0.4 : 1 }} title="Salida">− Salida</button>
                            <button onClick={() => onMovimiento(a, 'ajuste')} style={{ ...btnMini, color: '#1e40af' }} title="Ajuste por conteo">Ajuste</button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => onKardex(a)} style={btnMini}>Kardex</button>
                          <button onClick={() => onEditar(a)} style={btnMini}>Editar</button>
                          <button onClick={() => onActivar(a, !a.activo)} style={{ ...btnMini, color: '#64748b' }}>
                            {a.activo ? 'Desactivar' : 'Reactivar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
