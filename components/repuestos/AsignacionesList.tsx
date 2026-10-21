'use client'
import Link from 'next/link'
import type { Asignacion, FiltrosAsignaciones } from '@/types/repuestos'
import { inp, btnSec } from '@/components/movimientos/styles'
import { ESTADO_ASIG_COLOR, DESTINO_RETIRO_CORTO, fmtFechaCorta } from './constants'
import { Chip } from './shared'
import { imprimirAsignacion } from './imprimir'

type Props = {
  lista: Asignacion[]
  cargando: boolean
  filtros: FiltrosAsignaciones
  onFiltro: (f: Partial<FiltrosAsignaciones>) => void
  onRetirar: (a: Asignacion) => void
}

const td = { padding: '10px 14px', verticalAlign: 'top' as const }

export function AsignacionesList({ lista, cargando, filtros, onFiltro, onRetirar }: Props) {
  const porId = new Map(lista.map(a => [a.id, a]))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input value={filtros.buscar} onChange={e => onFiltro({ buscar: e.target.value })}
          placeholder="Buscar por equipo KL, persona, área o artículo..." style={{ ...inp, maxWidth: 340, flex: 1 }} />
        <select value={filtros.estado} onChange={e => onFiltro({ estado: e.target.value as FiltrosAsignaciones['estado'] })} style={{ ...inp, maxWidth: 190 }}>
          <option value="vigente">Vigentes (asignado hoy)</option>
          <option value="cerrada">Historial (cerradas)</option>
          <option value="">Todas</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
          <input type="checkbox" checked={filtros.vencidos} onChange={e => onFiltro({ vencidos: e.target.checked })} />
          Solo préstamos vencidos
        </label>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Sin asignaciones con esos filtros</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['#', 'Artículo', 'Asignado a', 'Entrega', 'Préstamo hasta', 'Estado', 'Retiro / reemplazo', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(a => {
                  const estado = a.vencido ? 'vencido' : a.estado
                  const reemplazaA = a.reemplaza_a ? porId.get(a.reemplaza_a) : undefined
                  return (
                    <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9', background: a.vencido ? '#fff7f7' : undefined }}>
                      <td style={{ ...td, color: '#94a3b8', fontFamily: 'monospace' }}>{a.id}</td>
                      <td style={{ ...td, minWidth: 200 }}>
                        <span style={{ fontFamily: 'monospace', color: '#0047BA', fontWeight: 700, fontSize: 12 }}>{a.articulo_codigo}</span>{' '}
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>{a.descripcion}</span>
                        {a.cantidad > 1 && <span style={{ color: '#64748b' }}> ×{a.cantidad}</span>}
                        {a.reemplaza_a && (
                          <div style={{ fontSize: 11, color: '#5b21b6' }}>
                            Reemplazó la asignación #{a.reemplaza_a}{reemplazaA ? ` (${reemplazaA.articulo_codigo})` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ ...td, minWidth: 180 }}>
                        {a.equipo_id ? (
                          <>
                            <Link href={`/sistemas/equipos/${a.equipo_id}`} style={{ color: '#0047BA', fontWeight: 700, fontFamily: 'monospace' }}>{a.equipo_id}</Link>
                            <span style={{ color: '#64748b', fontSize: 12 }}> {a.tipo_equipo} {a.equipo_marca}</span>
                            {a.persona_nombre && <div style={{ fontSize: 12, color: '#334155' }}>{a.persona_nombre}</div>}
                          </>
                        ) : (
                          <>
                            <div style={{ color: '#1e293b', fontWeight: 600 }}>{a.persona_nombre} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>(sin equipo)</span></div>
                          </>
                        )}
                        {a.persona_area && <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.persona_area}</div>}
                        {a.observaciones && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }} title={a.observaciones}>📝 {a.observaciones}</div>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: '#475569' }}>
                        {fmtFechaCorta(a.fecha_asignacion)}
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.registrado_por}</div>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: a.vencido ? '#dc2626' : '#475569', fontWeight: a.vencido ? 700 : 400 }}>
                        {a.es_prestamo ? fmtFechaCorta(a.fecha_limite_prestamo) : '—'}
                      </td>
                      <td style={td}>
                        <Chip texto={estado === 'vencido' ? 'Préstamo vencido' : estado[0].toUpperCase() + estado.slice(1)} {...ESTADO_ASIG_COLOR[estado]} />
                      </td>
                      <td style={{ ...td, fontSize: 12, color: '#334155', minWidth: 200 }}>
                        {a.estado === 'vigente' ? '—' : (
                          <>
                            <div><b>{a.destino_retiro ? DESTINO_RETIRO_CORTO[a.destino_retiro] : ''}</b> · {fmtFechaCorta(a.fecha_retiro)}</div>
                            <div>{a.motivo_retiro}{a.detalle_retiro ? ` — ${a.detalle_retiro}` : ''}</div>
                            {a.reemplazada_por && (
                              <div style={{ color: '#5b21b6' }}>
                                Reemplazado por #{a.reemplazada_por} {a.reemplazada_por_codigo} {a.reemplazada_por_descripcion}
                              </div>
                            )}
                            {a.cerrado_por && <div style={{ color: '#94a3b8' }}>{a.cerrado_por}</div>}
                          </>
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {a.estado === 'vigente' && (
                            <button onClick={() => onRetirar(a)} style={{ ...btnSec, fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}>Devolver / retirar</button>
                          )}
                          <button onClick={() => imprimirAsignacion(a.id, 'entrega')} style={{ ...btnSec, fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
                            title="Imprimir acta de entrega">🖨️ Entrega</button>
                          {a.estado !== 'vigente' && (
                            <button onClick={() => imprimirAsignacion(a.id, 'retiro')} style={{ ...btnSec, fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
                              title="Imprimir acta de devolución / retiro">🖨️ Retiro</button>
                          )}
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
