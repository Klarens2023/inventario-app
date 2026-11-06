'use client'
import { Fragment, useEffect, useState } from 'react'
import type { PedidoBusqueda, ResultadoAgregar } from '@/lib/cen/pedidosInstitucionales'
import { fmtFecha, fmtMoneda, fmtNumero } from './utils'

const campo: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }

// Trae pedidos ya creados en Siesa (últimos 8 días) y los agrega a una ruta como órdenes "Institucional",
// para que cuenten en la relación de despacho, los totales y los reportes. No crea nada en Siesa.
export function PedidosInstitucionalesModal({ onClose, onAgregados }: { onClose: () => void; onAgregados: (n: number) => void }) {
  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<{ desde: string; pedidos: PedidoBusqueda[]; truncado: boolean } | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [rutas, setRutas] = useState<string[]>([])
  const [ruta, setRuta] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoAgregar[] | null>(null)

  useEffect(() => {
    fetch('/api/logistica/ordenes-cen/rutas').then(r => r.ok ? r.json() : []).then((rs: { ruta: string }[]) => setRutas(rs.map(r => r.ruta)))
  }, [])

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault()
    if (!q.trim()) return
    setBuscando(true); setError(''); setResultados(null)
    try {
      const res = await fetch(`/api/logistica/ordenes-cen/institucional?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo buscar en Siesa')
      setResultado(data)
      setSeleccion(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error'); setResultado(null)
    } finally { setBuscando(false) }
  }

  async function agregar() {
    if (!seleccion.size || !ruta) return
    setAgregando(true); setError('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/institucional', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedidos: Array.from(seleccion), ruta }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron agregar')
      const rs = data.resultados as ResultadoAgregar[]
      setResultados(rs)
      setSeleccion(new Set())
      const ok = rs.filter(r => r.ok).length
      if (ok) onAgregados(ok)
      await buscar() // refresca las marcas de "ya está en el sistema"
      setResultados(rs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setAgregando(false) }
  }

  const alternar = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n }
  const disponibles = resultado?.pedidos.filter(p => !p.en_sistema) ?? []
  const elegidos = resultado?.pedidos.filter(p => seleccion.has(p.id)) ?? []

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 1000, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>Agregar pedido institucional</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>
              Pedidos ya creados en Siesa en los últimos 8 días. Se agregan a una ruta para contarlos en la relación de despacho,
              los totales y los reportes. No se crea ni se cambia nada en Siesa.
            </p>
          </div>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>

        <form onSubmit={buscar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="NIT, razón social o número de pedido (ej. PVK-16208)"
            style={{ ...campo, flex: 1, minWidth: 240 }} />
          <button className="btn btn-primary" disabled={buscando || !q.trim()}>{buscando ? 'Buscando en Siesa...' : 'Buscar'}</button>
        </form>

        {/* Solo esta parte se desplaza: el encabezado, el buscador y la barra de agregar quedan fijos */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        {resultados && (
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>
            {resultados.map(r => (
              <div key={r.id} style={{ color: r.ok ? '#047857' : 'var(--danger)' }}>{r.ok ? '✓' : '✗'} {r.pedido}: {r.mensaje}</div>
            ))}
          </div>
        )}

        {resultado && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
              {resultado.pedidos.length} pedido(s) desde el {fmtFecha(resultado.desde)}
              {resultado.pedidos.length > disponibles.length && ` · ${resultado.pedidos.length - disponibles.length} ya están en el sistema`}
              {resultado.truncado && ' · hay más resultados: afina la búsqueda'}
            </div>
            {resultado.pedidos.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text2)' }}>No hay pedidos con esa búsqueda en los últimos 8 días.</div>}
            {resultado.pedidos.length > 0 && (
              <div className="cen-scroll" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                <table className="inv-table cen-tabla cen-tarjetas">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}>
                        <input type="checkbox" disabled={!disponibles.length} checked={disponibles.length > 0 && disponibles.every(p => seleccion.has(p.id))}
                          onChange={e => setSeleccion(e.target.checked ? new Set(disponibles.map(p => p.id)) : new Set())} style={{ width: 16, height: 16 }} />
                      </th>
                      <th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Entrega</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>Valor</th><th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.pedidos.map(p => (
                      <Fragment key={p.id}>
                        <tr onClick={() => !p.en_sistema && setSeleccion(s => alternar(s, p.id))}
                          style={{ cursor: p.en_sistema ? 'default' : 'pointer', background: seleccion.has(p.id) ? '#EFF6FF' : p.en_sistema ? 'var(--bg)' : undefined }}>
                          <td className="sel" data-label="">
                            <input type="checkbox" disabled={!!p.en_sistema} checked={seleccion.has(p.id)} onClick={e => e.stopPropagation()}
                              onChange={() => setSeleccion(s => alternar(s, p.id))} style={{ width: 18, height: 18 }} />
                          </td>
                          <td data-label="Pedido" className="nw">
                            <div>
                              <strong>{p.pedido}</strong>
                              <span className="sub">{p.referencia ? `Ref. ${p.referencia}` : `CO ${p.co}`}{p.usuario && ` · ${p.usuario}`}</span>
                            </div>
                          </td>
                          <td data-label="Cliente" className="ancho">
                            <div>
                              {p.razon_social}
                              <span className="sub">{p.nit}/{p.sucursal}{p.notas && ` · ${p.notas}`}</span>
                            </div>
                          </td>
                          <td data-label="Fecha" className="nw">{fmtFecha(p.fecha)}</td>
                          <td data-label="Entrega" className="nw">{fmtFecha(p.fecha_entrega)}</td>
                          <td data-label="Cantidad" className="num">
                            <div>{fmtNumero(p.unidades, 1)}
                              <span className="sub"><button type="button" onClick={e => { e.stopPropagation(); setAbiertos(s => alternar(s, p.id)) }}
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 12 }}>
                                {p.lineas.length} producto(s) {abiertos.has(p.id) ? '▲' : '▼'}</button></span>
                            </div>
                          </td>
                          <td data-label="Valor" className="num">{fmtMoneda(p.valor)}</td>
                          <td data-label="Estado">
                            {p.en_sistema
                              ? <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>Ya está{p.en_sistema.ruta ? ` en ${p.en_sistema.ruta}` : ''}{p.en_sistema.fuente !== 'institucional' ? ` (OC ${p.en_sistema.numero_orden})` : ''}</span>
                              : <span style={{ fontSize: 12, color: 'var(--text2)' }}>{p.estado_label}</span>}
                          </td>
                        </tr>
                        {abiertos.has(p.id) && (
                          <tr>
                            <td colSpan={8} style={{ background: 'var(--bg)', fontSize: 12 }}>
                              {p.lineas.map((l, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, padding: '2px 0' }}>
                                  <span style={{ minWidth: 50, color: 'var(--text2)' }}>{l.f120_id}</span>
                                  <span style={{ flex: 1 }}>{l.descripcion}</span>
                                  <span>{fmtNumero(l.cantidad, 2)} {l.unidad}</span>
                                  <span style={{ minWidth: 90, textAlign: 'right' }}>{fmtMoneda(l.bruto)}</span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        </div>

        {seleccion.size > 0 && (
          <div style={{ flexShrink: 0, background: '#fff', borderTop: '2px solid var(--accent)', boxShadow: '0 -6px 12px -8px rgba(0,0,0,.25)', marginTop: 12, paddingTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14 }}>{seleccion.size} pedido(s)</strong>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{fmtMoneda(elegidos.reduce((s, p) => s + p.valor, 0))}</span>
            <select value={ruta} onChange={e => setRuta(e.target.value)} style={{ ...campo, marginLeft: 'auto' }}>
              <option value="">Elige la ruta...</option>
              {rutas.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!ruta || agregando} onClick={agregar}>
              {agregando ? 'Agregando...' : `Agregar a ${ruta || 'la ruta'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
