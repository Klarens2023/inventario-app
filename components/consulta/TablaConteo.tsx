'use client'
import type { EditState, Row } from '@/types/consulta'
import { fmt } from './utils'
import { inputStyle } from './constants'
import { StatusDot } from './StatusDot'

type Totals = {
  totalCantidad: number; totalConteo: number; totalBodega: number
  totalDif: number; totalDifCantidad: number; hayConteo: boolean
}

type Props = {
  loading: boolean
  hayDatos: boolean
  esLotes: boolean
  rowsMostradas: Row[]
  edits: Record<number, EditState>
  puedeEditar: (row: Row) => boolean
  onChangeConteo: (id: number, value: string) => void
  onChangeObs: (id: number, value: string) => void
  onBlurConteo: (id: number) => void
  totals: Totals
}

export function TablaConteo({
  loading, hayDatos, esLotes, rowsMostradas, edits, puedeEditar,
  onChangeConteo, onChangeObs, onBlurConteo, totals,
}: Props) {
  const { totalCantidad, totalConteo, totalBodega, totalDif, totalDifCantidad, hayConteo } = totals

  const headers = esLotes
    ? ['Referencia', 'Descripcion', 'Lote', 'Loc', 'UM', 'Categoria', 'Subcategoria', 'Cant. Sis.', 'Conteo', 'Diferencia', 'C. Unit.', 'C. Dif.', 'C. Bodega', 'Observaciones']
    : ['Referencia', 'Descripcion', 'Loc', 'UM', 'Categoria', 'Subcategoria', 'Cant. Sis.', 'Conteo', 'Diferencia', 'C. Unit.', 'C. Dif.', 'C. Bodega', 'Observaciones']
  const numCols   = esLotes ? [7, 8, 9, 10, 11, 12] : [6, 7, 8, 9, 10, 11]
  const colspanGT = esLotes ? 7 : 6

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
      ) : !hayDatos ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          No hay datos para este modo y fecha. <a href="/cargar" style={{ color: '#2563eb' }}>Cargar inventario</a>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            {esLotes ? (
              <>
                <col style={{ width: '7%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
              </>
            ) : (
              <>
                <col style={{ width: '7%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
              </>
            )}
          </colgroup>
          <thead>
            <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '10px 8px',
                  textAlign: numCols.includes(i) ? 'right' : 'left',
                  fontSize: 11, fontWeight: 700,
                  color: h === 'Conteo' || h === 'Observaciones' ? '#16a34a' : '#374151',
                  borderBottom: '2px solid #e5e7eb',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsMostradas.map((r, idx) => {
              const e        = edits[r.id] ?? { conteo: '', obs: '', status: 'idle' as const }
              const conteo   = e.conteo !== '' ? Number(e.conteo) : 0
              const dif      = conteo - Number(r.cantidad_sistema)
              const cDif     = dif * Number(r.costo_unitario)
              const bg       = idx % 2 === 0 ? '#fff' : '#f9fafb'
              const editable = puedeEditar(r)
              const bgEdit   = r.acumulado ? '#f1f5f9' : !editable ? '#fffbeb' : '#f0fdf4'
              const titleEdit = r.acumulado ? 'Acumulado' : !editable ? 'Solo puede editar quien subio este inventario' : ''
              return (
                <tr key={r.id} style={{ background: bg }}>
                  <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }}>{r.referencia}</td>
                  <td style={{ padding: '7px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }} title={r.descripcion}>{r.descripcion}</td>
                  {esLotes && (
                    <td style={{ padding: '7px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }} title={r.lote ?? ''}>
                      {r.lote || '—'}
                    </td>
                  )}
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.localizacion}</td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.um}</td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0f0f0', fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.categoria}</td>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0f0f0', overflow: 'hidden' }}>
                    {r.tipo && <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 5px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tipo}</span>}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden' }}>{Number(r.cantidad_sistema).toLocaleString('es-CO')}</td>

                  {/* CONTEO */}
                  <td style={{ padding: '3px 4px', borderBottom: '1px solid #f0f0f0', background: bgEdit }} title={titleEdit}>
                    {!editable ? (
                      <span style={{ display: 'block', textAlign: 'right', padding: '2px 4px', color: r.acumulado ? '#94a3b8' : '#92400e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.conteo !== '' ? Number(e.conteo).toLocaleString('es-CO') : '—'}
                      </span>
                    ) : (
                      <input
                        type="text" inputMode="decimal"
                        value={e.conteo}
                        onChange={ev => onChangeConteo(r.id, ev.target.value)}
                        onBlur={ev => { onBlurConteo(r.id); ev.target.style.background = 'transparent' }}
                        onKeyDown={ev => { if (ev.key === 'Enter') { onBlurConteo(r.id); (ev.target as HTMLInputElement).blur() } }}
                        placeholder="—"
                        style={{
                          ...inputStyle, textAlign: 'right',
                          color: /[+\-]/.test(e.conteo) ? '#0047BA' : 'inherit',
                          fontWeight: /[+\-]/.test(e.conteo) ? 600 : 'normal',
                        }}
                        onFocus={ev => { ev.target.style.background = '#dcfce7'; ev.target.style.borderRadius = '4px' }}
                        title="Puedes escribir sumas: ej. 4+6+97"
                      />
                    )}
                  </td>

                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', color: e.conteo !== '' && dif < 0 ? '#ef4444' : e.conteo !== '' && dif > 0 ? '#16a34a' : 'inherit' }}>
                    {e.conteo !== '' ? dif.toLocaleString('es-CO') : '—'}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmt(r.costo_unitario)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden', color: e.conteo !== '' && cDif < 0 ? '#ef4444' : 'inherit' }}>
                    {e.conteo !== '' ? fmt(cDif) : '—'}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', overflow: 'hidden' }}>{fmt(r.costo_bodega)}</td>

                  {/* OBSERVACIONES */}
                  <td style={{ padding: '3px 4px', borderBottom: '1px solid #f0f0f0', background: bgEdit }}>
                    {!editable ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ flex: 1, padding: '2px 4px', color: '#6b7280', fontStyle: e.obs ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.obs || '—'}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input type="text" value={e.obs} onChange={ev => onChangeObs(r.id, ev.target.value)}
                          placeholder="Observacion..." style={{ ...inputStyle, flex: 1, width: 'auto' }}
                          onFocus={ev => { ev.target.style.background = '#dcfce7'; ev.target.style.borderRadius = '4px' }}
                          onBlur={ev  => { ev.target.style.background = 'transparent' }} />
                        <StatusDot status={e.status} />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* GRAN TOTAL */}
          <tfoot>
            <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
              <td colSpan={colspanGT} style={{ padding: '10px 8px', fontSize: 13, color: '#374151' }}>Gran total</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden' }}>{totalCantidad.toLocaleString('es-CO')}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, color: '#16a34a', whiteSpace: 'nowrap', overflow: 'hidden' }}>{hayConteo ? totalConteo.toLocaleString('es-CO') : '—'}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', color: totalDifCantidad < 0 ? '#ef4444' : totalDifCantidad > 0 ? '#16a34a' : 'inherit' }}>{hayConteo ? totalDifCantidad.toLocaleString('es-CO') : '—'}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13 }}>—</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', color: totalDif < 0 ? '#ef4444' : totalDif > 0 ? '#16a34a' : 'inherit' }}>{hayConteo ? fmt(totalDif) : '—'}</td>
              <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden' }}>{fmt(totalBodega)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
