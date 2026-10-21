'use client'
import Link from 'next/link'
import type { Articulo, FiltrosKardex, MovimientoArticulo } from '@/types/repuestos'
import { inp, btnSec } from '@/components/movimientos/styles'
import { TIPO_MOV_COLOR, TIPO_MOV_LABEL } from './constants'
import { Chip, fmtPesos } from './shared'
import { imprimirMovimiento } from './imprimir'

type Props = {
  lista: MovimientoArticulo[]
  cargando: boolean
  filtros: FiltrosKardex
  articulo: Articulo | null
  onFiltro: (f: Partial<FiltrosKardex>) => void
  onQuitarArticulo: () => void
}

function fmtFecha(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function KardexList({ lista, cargando, filtros, articulo, onFiltro, onQuitarArticulo }: Props) {
  return (
    <div>
      {articulo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 14, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: 13 }}>
          <span style={{ color: '#475569' }}>Kardex de</span>
          <b style={{ color: '#0047BA', fontFamily: 'monospace' }}>{articulo.codigo}</b>
          <span style={{ flex: 1, color: '#1e293b', fontWeight: 600 }}>{articulo.descripcion}</span>
          <span style={{ color: '#475569' }}>Stock actual: <b>{articulo.stock_actual}</b></span>
          <button onClick={onQuitarArticulo} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>Ver todos</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input value={filtros.buscar} onChange={e => onFiltro({ buscar: e.target.value })}
          placeholder="Buscar por artículo, equipo, persona, proveedor, factura..." style={{ ...inp, maxWidth: 340, flex: 1 }} />
        <select value={filtros.tipo} onChange={e => onFiltro({ tipo: e.target.value })} style={{ ...inp, maxWidth: 160 }}>
          <option value="">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="ajuste">Ajustes</option>
        </select>
        <input type="date" value={filtros.desde} onChange={e => onFiltro({ desde: e.target.value })} style={{ ...inp, maxWidth: 160 }} />
        <input type="date" value={filtros.hasta} onChange={e => onFiltro({ hasta: e.target.value })} style={{ ...inp, maxWidth: 160 }} />
      </div>

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
                  {['Fecha', 'Tipo', 'Artículo', 'Motivo', 'Cant.', 'Saldo', 'Equipo / Destino', 'Proveedor / Doc.', 'Registró', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid #f1f5f9' }} title={m.observaciones ?? undefined}>
                    <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtFecha(m.fecha)}</td>
                    <td style={{ padding: '10px 14px' }}><Chip texto={TIPO_MOV_LABEL[m.tipo]} {...TIPO_MOV_COLOR[m.tipo]} /></td>
                    <td style={{ padding: '10px 14px', minWidth: 200 }}>
                      <span style={{ fontFamily: 'monospace', color: '#0047BA', fontWeight: 700, fontSize: 12 }}>{m.articulo_codigo}</span>{' '}
                      <span style={{ color: '#1e293b' }}>{m.descripcion}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{m.motivo}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap',
                      color: m.cantidad > 0 ? '#065f46' : m.cantidad < 0 ? '#9a3412' : '#64748b' }}>
                      {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>{m.stock_resultante}</td>
                    <td style={{ padding: '10px 14px', color: '#334155', fontSize: 12 }}>
                      {m.equipo_id && (
                        <Link href={`/sistemas/equipos/${m.equipo_id}`} style={{ color: '#0047BA', fontWeight: 700, fontFamily: 'monospace' }}>{m.equipo_id}</Link>
                      )}
                      {m.equipo_id && m.destino_nombre ? ' · ' : ''}
                      {m.destino_nombre}
                      {m.destino_area && <span style={{ color: '#94a3b8' }}> ({m.destino_area})</span>}
                      {!m.equipo_id && !m.destino_nombre && '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569', fontSize: 12 }}>
                      {[m.proveedor, m.documento_ref].filter(Boolean).join(' · ') || '—'}
                      {m.tipo === 'entrada' && m.costo_unitario && <div style={{ color: '#94a3b8' }}>{fmtPesos(m.costo_unitario)} c/u</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{m.registrado_por}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => imprimirMovimiento(m.id)} title="Imprimir comprobante o acta"
                        style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>🖨️</button>
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
