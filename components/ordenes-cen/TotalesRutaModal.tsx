'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { fmtMoneda, fmtNumero } from './utils'

type Fila = { punto: string; nit: string | null; sucursal: string | null; ean_item: string; f120_id: number | null; descripcion: string | null; cantidad: number; valor: number; peso: number | null }
type Modo = 'item' | 'cliente'
type Total = { cantidad: number; valor: number; peso: number; pesoCompleto: boolean }
type Columna = 'nombre' | 'ean' | 'cantidad' | 'valor' | 'peso'
type Orden = { col: Columna; asc: boolean }
type Ordenable = Total & { nombre: string; ean?: string }

const sumar = (fs: Fila[]): Total => ({
  cantidad: fs.reduce((s, f) => s + f.cantidad, 0),
  valor: fs.reduce((s, f) => s + f.valor, 0),
  peso: fs.reduce((s, f) => s + (f.peso ?? 0), 0),
  pesoCompleto: fs.every(f => f.peso !== null),
})
const nombreItem = (f: Fila) => f.descripcion ?? f.ean_item
const etiquetaItem = (f: { f120_id: number | null; nombre: string }) => `${f.f120_id ? `${f.f120_id} · ` : ''}${f.nombre}`

function ordenar<T extends Ordenable>(lista: T[], o: Orden): T[] {
  const signo = o.asc ? 1 : -1
  return [...lista].sort((a, b) => {
    if (o.col === 'nombre') return signo * a.nombre.localeCompare(b.nombre)
    if (o.col === 'ean') return signo * (a.ean ?? '').localeCompare(b.ean ?? '')
    return signo * (a[o.col] - b[o.col])
  })
}

// Tabla de totales de una ruta (como las hojas de relación de "BD 2026"): por ítem, o por cliente
// (punto de venta) con sus ítems. Las columnas se ordenan con clic; los clientes arrancan recogidos.
// La vista por defecto se guarda por ruta.
export function TotalesRutaModal({ titulo, ruta, ids, onClose }: { titulo: string; ruta: string | null; ids: number[]; onClose: () => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [modo, setModo] = useState<Modo>('item')
  const [modoRuta, setModoRuta] = useState<Modo>('item')
  const [orden, setOrden] = useState<Orden>({ col: 'nombre', asc: true })
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/logistica/ordenes-cen/totales?ids=${ids.join(',')}&ruta=${encodeURIComponent(ruta ?? '')}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setFilas(d.filas); setModo(d.modo); setModoRuta(d.modo) })
      .catch(e => setError(e.message ?? 'No se pudieron calcular los totales'))
  }, [ids, ruta])

  const porItem = useMemo(() => {
    const m = new Map<string, Fila[]>()
    for (const f of filas ?? []) m.set(f.ean_item, [...(m.get(f.ean_item) ?? []), f])
    return ordenar(Array.from(m.values()).map(fs => ({ nombre: nombreItem(fs[0]), f120_id: fs[0].f120_id, ean: fs[0].ean_item, ...sumar(fs) })), orden)
  }, [filas, orden])

  const porCliente = useMemo(() => {
    const m = new Map<string, Fila[]>()
    for (const f of filas ?? []) {
      const k = f.nit ? `${f.punto} (${f.nit}/${f.sucursal})` : f.punto
      m.set(k, [...(m.get(k) ?? []), f])
    }
    const ordenItems = orden.col === 'ean' ? { ...orden, col: 'nombre' as const } : orden
    return ordenar(Array.from(m.entries()).map(([cliente, fs]) => ({
      nombre: cliente,
      items: ordenar(fs.map(f => ({ ...f, nombre: nombreItem(f), ean: f.ean_item, peso: f.peso ?? 0, pesoCompleto: f.peso !== null })), ordenItems),
      ...sumar(fs),
    })), ordenItems)
  }, [filas, orden])

  const total = sumar(filas ?? [])
  const peso = (t: { peso: number; pesoCompleto: boolean }) => t.pesoCompleto ? `${fmtNumero(t.peso, 1)} kg` : `${fmtNumero(t.peso, 1)} kg*`

  async function guardarPorDefecto() {
    if (!ruta) return
    const res = await fetch('/api/logistica/ordenes-cen/totales', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruta, totales: modo }) })
    if (res.ok) setModoRuta(modo); else setError((await res.json()).error ?? 'No se pudo guardar')
  }

  const alternar = (k: string) => setAbiertos(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  // Encabezado ordenable: clic ordena por esa columna; otro clic invierte el sentido.
  const Th = ({ col, children, derecha }: { col: Columna; children: React.ReactNode; derecha?: boolean }) => (
    <th onClick={() => setOrden(o => ({ col, asc: o.col === col ? !o.asc : col === 'nombre' || col === 'ean' }))}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: derecha ? 'right' : undefined }}
      title="Ordenar por esta columna">
      {children} <span style={{ opacity: orden.col === col ? 1 : 0.3 }}>{orden.col === col ? (orden.asc ? '▲' : '▼') : '▲▼'}</span>
    </th>
  )

  const td: React.CSSProperties = { textAlign: 'right' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Totales · {titulo}</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{ids.length} orden(es) · vista por defecto de la ruta: por {modoRuta === 'item' ? 'ítem' : 'cliente'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {(['item', 'cliente'] as const).map(m => (
                <button key={m} onClick={() => setModo(m)} style={{ padding: '6px 12px', fontSize: 13, border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: modo === m ? 'var(--accent)' : '#fff', color: modo === m ? '#fff' : 'var(--text)' }}>
                  Por {m === 'item' ? 'ítem' : 'cliente'}
                </button>
              ))}
            </div>
            {modo === 'cliente' && porCliente.length > 0 && (
              <button className="btn" onClick={() => setAbiertos(abiertos.size > 0 ? new Set() : new Set(porCliente.map(c => c.nombre)))}>
                {abiertos.size > 0 ? 'Recoger todos' : 'Expandir todos'}
              </button>
            )}
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
                  <thead><tr><Th col="nombre">Descripción</Th><Th col="ean">EAN</Th><Th col="cantidad" derecha>Cant. despacho</Th><Th col="valor" derecha>$ Total</Th><Th col="peso" derecha>Peso</Th></tr></thead>
                  <tbody>
                    {porItem.map(i => (
                      <tr key={i.ean}><td>{etiquetaItem(i)}</td><td style={{ fontFamily: 'monospace' }}>{i.ean}</td>
                        <td style={td}>{fmtNumero(i.cantidad)}</td><td style={td}>{fmtMoneda(i.valor)}</td><td style={td}>{peso(i)}</td></tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><Th col="nombre">Cliente / ítem</Th><Th col="cantidad" derecha>Cant. despacho</Th><Th col="valor" derecha>$ Total</Th><Th col="peso" derecha>Peso</Th></tr></thead>
                  <tbody>
                    {porCliente.map(c => {
                      const abierto = abiertos.has(c.nombre)
                      return (
                        <Fragment key={c.nombre}>
                          <tr onClick={() => alternar(c.nombre)} style={{ background: 'var(--bg)', fontWeight: 700, cursor: 'pointer' }} title={abierto ? 'Recoger' : 'Ver ítems'}>
                            <td>
                              <span style={{ display: 'inline-block', width: 14, fontSize: 11, color: 'var(--text2)', transition: 'transform .15s', transform: abierto ? 'none' : 'rotate(-90deg)' }}>▼</span>
                              {c.nombre} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text2)' }}>· {c.items.length} ítem(s)</span>
                            </td>
                            <td style={td}>{fmtNumero(c.cantidad)}</td><td style={td}>{fmtMoneda(c.valor)}</td><td style={td}>{peso(c)}</td>
                          </tr>
                          {abierto && c.items.map(f => (
                            <tr key={c.nombre + f.ean_item}>
                              <td style={{ paddingLeft: 36 }}>{etiquetaItem(f)}</td><td style={td}>{fmtNumero(f.cantidad)}</td>
                              <td style={td}>{fmtMoneda(f.valor)}</td><td style={td}>{f.pesoCompleto ? `${fmtNumero(f.peso, 1)} kg` : '—'}</td>
                            </tr>
                          ))}
                        </Fragment>
                      )
                    })}
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
