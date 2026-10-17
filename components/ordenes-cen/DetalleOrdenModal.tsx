'use client'
import { useEffect, useMemo, useState } from 'react'
import type { DetalleOrdenCen } from '@/types/ordenes-cen'
import { nombreComprador } from '@/lib/cen/compradores'
import { fmtFecha, fmtMoneda, fmtNumero, ESTADOS, relacion } from './utils'
import { PedidoSiesa } from './PedidoSiesa'

export function DetalleOrdenModal({ id, onClose, onCambio }: { id: number; onClose: () => void; onCambio: () => void }) {
  const [detalle, setDetalle] = useState<DetalleOrdenCen | null>(null)
  const [error, setError] = useState('')
  const [verReparto, setVerReparto] = useState(false)
  const [rutaNueva, setRutaNueva] = useState('')
  const [rutas, setRutas] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/logistica/ordenes-cen/${id}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setDetalle(d) })
      .catch(e => setError(e.message ?? 'No se pudo cargar la orden'))
    fetch('/api/logistica/ordenes-cen/reglas').then(r => r.ok ? r.json() : []).then((rs: { ruta: string }[]) =>
      setRutas(Array.from(new Set(rs.map(r => r.ruta))).sort()))
  }, [id])

  // Reparto agrupado por tienda: total de unidades por local.
  const repartoPorLocal = useMemo(() => {
    const m = new Map<string, { nombre: string; unidades: number; items: number }>()
    for (const d of detalle?.distribucion ?? []) {
      const actual = m.get(d.ean_local) ?? { nombre: d.razon_social ? `${d.razon_social} (${d.nit}/${d.sucursal})` : 'Sin homologar', unidades: 0, items: 0 }
      actual.unidades += d.cantidad; actual.items += 1
      m.set(d.ean_local, actual)
    }
    return Array.from(m.entries())
  }, [detalle])

  async function cambiarEstado(accion: 'descartar' | 'reactivar' | 'ruta', ruta?: string) {
    const res = await fetch(`/api/logistica/ordenes-cen/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, ruta }) })
    if (res.ok) { onCambio(); onClose() } else setError((await res.json()).error ?? 'No se pudo actualizar')
  }

  const o = detalle?.orden
  const sinMaestro = detalle?.lineas.filter(l => l.peso_kg === null).length ?? 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 980, maxHeight: '90vh', overflowY: 'auto' }}>
        {!detalle && !error && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>Cargando...</div>}
        {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        {o && detalle && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{nombreComprador(o.ean_comprador).toUpperCase()} · {o.fuente === 'carvajal' ? 'Carvajal (CEN)' : 'Subrik'}</div>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>OC {o.numero_orden}</h2>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                  {o.razon_social ? `${o.razon_social} · ${o.nit}/${o.sucursal}` : `Punto sin homologar · EAN ${o.ean_entrega}`}
                </div>
              </div>
              <span style={{ background: ESTADOS[o.estado].bg, color: ESTADOS[o.estado].color, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                {ESTADOS[o.estado].label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                ['Fecha OC', fmtFecha(o.fecha_orden)],
                ['Entrega', o.fecha_entrega_max && o.fecha_entrega_max !== o.fecha_entrega ? `${fmtFecha(o.fecha_entrega)} a ${fmtFecha(o.fecha_entrega_max)}` : fmtFecha(o.fecha_entrega)],
                ['Unidades', fmtNumero(o.total_unidades)],
                ['Valor', fmtMoneda(o.valor_total)],
                ['Peso', o.peso_kg !== null ? `${fmtNumero(o.peso_kg, 1)} kg` : 'Incompleto'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>
                Ruta: <strong>{o.ruta ?? 'sin ruta'}</strong>
                {o.ruta && <span style={{ color: 'var(--text2)' }}> · relación {relacion(o.ruta, o.fecha_entrega)}{o.ruta_manual ? ' · asignada a mano' : ' · sugerida por regla'}</span>}
              </span>
              {o.estado !== 'enviado' && (
                <>
                  <input list="rutas-cen" value={rutaNueva} onChange={e => setRutaNueva(e.target.value.toUpperCase())} placeholder="Cambiar ruta..."
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, marginLeft: 'auto' }} />
                  <datalist id="rutas-cen">{rutas.map(r => <option key={r} value={r} />)}</datalist>
                  <button className="btn" disabled={!rutaNueva} onClick={() => cambiarEstado('ruta', rutaNueva)}>Asignar</button>
                  {o.ruta_manual && <button className="btn" onClick={() => cambiarEstado('ruta', '')}>Volver a la sugerida</button>}
                </>
              )}
            </div>

            {sinMaestro > 0 && (
              <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
                {sinMaestro} producto(s) no están en el maestro de productos: no se puede calcular el peso completo de la orden.
              </div>
            )}

            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table className="inv-table">
                <thead>
                  <tr><th>#</th><th>EAN</th><th>Producto</th><th>Ítem Siesa</th><th>Cód. comprador</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th>IVA</th><th>Peso</th></tr>
                </thead>
                <tbody>
                  {detalle.lineas.map(l => (
                    <tr key={l.id}>
                      <td>{l.nro_linea}</td>
                      <td style={{ fontFamily: 'monospace' }}>{l.ean_item}</td>
                      <td>{l.descripcion_maestro || l.descripcion || '—'}</td>
                      <td>{l.item_siesa ?? <a href="/logistica/ordenes-cen/productos" style={{ color: '#B45309' }}>Sin asignar</a>}</td>
                      <td>{l.cod_comprador}</td>
                      <td style={{ textAlign: 'right' }}>{fmtNumero(l.cantidad)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoneda(l.precio)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoneda(l.cantidad * l.precio)}</td>
                      <td style={{ textAlign: 'right' }}>{l.iva === null ? '—' : `${l.iva}%`}</td>
                      <td style={{ textAlign: 'right' }}>{l.peso_kg === null ? '—' : `${fmtNumero(l.cantidad * l.peso_kg, 1)} kg`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {repartoPorLocal.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button className="btn" onClick={() => setVerReparto(v => !v)}>
                  {verReparto ? 'Ocultar' : 'Ver'} reparto por tienda ({repartoPorLocal.length} tiendas)
                </button>
                {verReparto && (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginTop: 8, maxHeight: 320 }}>
                    <table className="inv-table">
                      <thead><tr><th>EAN tienda</th><th>Tienda</th><th>Productos</th><th>Unidades</th></tr></thead>
                      <tbody>
                        {repartoPorLocal.map(([ean, r]) => (
                          <tr key={ean}>
                            <td style={{ fontFamily: 'monospace' }}>{ean}</td>
                            <td>{r.nombre}</td>
                            <td style={{ textAlign: 'right' }}>{r.items}</td>
                            <td style={{ textAlign: 'right' }}>{fmtNumero(r.unidades)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <PedidoSiesa orden={o} onEnviado={onCambio} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              {o.estado !== 'enviado' && o.estado !== 'descartada' && (
                <button className="btn btn-danger" onClick={() => cambiarEstado('descartar')}>Descartar orden</button>
              )}
              {o.estado === 'descartada' && <button className="btn" onClick={() => cambiarEstado('reactivar')}>Reactivar</button>}
              <button className="btn" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
