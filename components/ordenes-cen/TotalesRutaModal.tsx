'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { fmtMoneda, fmtNumero } from './utils'

type Fila = { punto: string; nit: string | null; sucursal: string | null; ean_item: string; f120_id: number | null; descripcion: string | null; cantidad: number; valor: number; peso: number | null }
type Modo = 'item' | 'cliente'
type Total = { cantidad: number; valor: number; peso: number; pesoCompleto: boolean }

const sumar = (fs: Fila[]): Total => ({
  cantidad: fs.reduce((s, f) => s + f.cantidad, 0),
  valor: fs.reduce((s, f) => s + f.valor, 0),
  peso: fs.reduce((s, f) => s + (f.peso ?? 0), 0),
  pesoCompleto: fs.every(f => f.peso !== null),
})
const nombreItem = (f: Fila) => `${f.f120_id ? `${f.f120_id} · ` : ''}${f.descripcion ?? f.ean_item}`

// Tabla de totales de una ruta (como las hojas de relación de "BD 2026"): por ítem, o por cliente
// (punto de venta) con sus ítems. La vista por defecto se guarda por ruta.
export function TotalesRutaModal({ titulo, ruta, ids, onClose }: { titulo: string; ruta: string | null; ids: number[]; onClose: () => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [modo, setModo] = useState<Modo>('item')
  const [modoRuta, setModoRuta] = useState<Modo>('item')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/logistica/ordenes-cen/totales?ids=${ids.join(',')}&ruta=${encodeURIComponent(ruta ?? '')}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setFilas(d.filas); setModo(d.modo); setModoRuta(d.modo) })
      .catch(e => setError(e.message ?? 'No se pudieron calcular los totales'))
  }, [ids, ruta])

  const porItem = useMemo(() => {
    const m = new Map<string, Fila[]>()
    for (const f of filas ?? []) m.set(f.ean_item, [...(m.get(f.ean_item) ?? []), f])
    return Array.from(m.values()).map(fs => ({ nombre: nombreItem(fs[0]), ean: fs[0].ean_item, ...sumar(fs) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [filas])

  const porCliente = useMemo(() => {
    const m = new Map<string, Fila[]>()
    for (const f of filas ?? []) {
      const k = f.nit ? `${f.punto} (${f.nit}/${f.sucursal})` : f.punto
      m.set(k, [...(m.get(k) ?? []), f])
    }
    return Array.from(m.entries()).map(([cliente, fs]) => ({ cliente, filas: fs, ...sumar(fs) }))
  }, [filas])

  const total = sumar(filas ?? [])
  const peso = (t: { peso: number; pesoCompleto: boolean }) => t.pesoCompleto ? `${fmtNumero(t.peso, 1)} kg` : `${fmtNumero(t.peso, 1)} kg*`

  async function guardarPorDefecto() {
    if (!ruta) return
    const res = await fetch('/api/logistica/ordenes-cen/totales', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruta, totales: modo }) })
    if (res.ok) setModoRuta(modo); else setError((await res.json()).error ?? 'No se pudo guardar')
  }

  const td: React.CSSProperties = { textAlign: 'right' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Totales · {titulo}</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{ids.length} orden(es) · vista por defecto de la ruta: por {modoRuta === 'item' ? 'ítem' : 'cliente'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['item', 'cliente'] as const).map(m => (
                <button key={m} onClick={() => setModo(m)} style={{ padding: '6px 12px', fontSize: 13, border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: modo === m ? 'var(--accent)' : '#fff', color: modo === m ? '#fff' : 'var(--text)' }}>
                  Por {m === 'item' ? 'ítem' : 'cliente'}
                </button>
              ))}
            </div>
            {ruta && modo !== modoRuta && <button className="btn" onClick={guardarPorDefecto}>Usar por defecto en {ruta}</button>}
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
        {!filas && !error && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>Calculando...</div>}

        {filas && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table className="inv-table">
              {modo === 'item' ? (
                <>
                  <thead><tr><th>Descripción</th><th>EAN</th><th>Cant. despacho</th><th>$ Total</th><th>Peso</th></tr></thead>
                  <tbody>
                    {porItem.map(i => (
                      <tr key={i.ean}><td>{i.nombre}</td><td style={{ fontFamily: 'monospace' }}>{i.ean}</td>
                        <td style={td}>{fmtNumero(i.cantidad)}</td><td style={td}>{fmtMoneda(i.valor)}</td><td style={td}>{peso(i)}</td></tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><th>Cliente / ítem</th><th>Cant. despacho</th><th>$ Total</th><th>Peso</th></tr></thead>
                  <tbody>
                    {porCliente.map(c => (
                      <Fragment key={c.cliente}>
                        <tr style={{ background: 'var(--bg)', fontWeight: 700 }}>
                          <td>{c.cliente}</td><td style={td}>{fmtNumero(c.cantidad)}</td><td style={td}>{fmtMoneda(c.valor)}</td><td style={td}>{peso(c)}</td>
                        </tr>
                        {c.filas.map(f => (
                          <tr key={c.cliente + f.ean_item}>
                            <td style={{ paddingLeft: 28 }}>{nombreItem(f)}</td><td style={td}>{fmtNumero(f.cantidad)}</td>
                            <td style={td}>{fmtMoneda(f.valor)}</td><td style={td}>{f.peso === null ? '—' : `${fmtNumero(f.peso, 1)} kg`}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </>
              )}
              <tfoot>
                <tr style={{ fontWeight: 800 }}>
                  <td colSpan={modo === 'item' ? 2 : 1}>Total general</td>
                  <td style={td}>{fmtNumero(total.cantidad)}</td><td style={td}>{fmtMoneda(total.valor)}</td><td style={td}>{peso(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {filas && !total.pesoCompleto && <div style={{ fontSize: 12, color: '#B45309', marginTop: 8 }}>* Peso incompleto: hay productos que no están en el maestro de productos.</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
