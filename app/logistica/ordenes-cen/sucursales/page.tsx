'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BodegaSelect } from '@/components/ordenes-cen/BodegaSelect'

type Sucursal = { ean: string; nit: string; sucursal: string; razon_social: string; ciudad: string | null; bodega: string | null; ordenes: number }

const inp: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }

// Sucursales homologadas (EAN de entrega → NIT/sucursal de Siesa) y la bodega desde la
// que se despacha cada una: la bodega va amarrada a la sucursal, no al cliente.
export default function SucursalesCenPage() {
  const [filas, setFilas] = useState<Sucursal[]>([])
  const [buscar, setBuscar] = useState('')
  const [soloConOrdenes, setSoloConOrdenes] = useState(true)
  const [editando, setEditando] = useState<{ ean: string; bodega: string } | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  // Cambio de bodega a varias sucursales a la vez
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [bodegaLote, setBodegaLote] = useState('00110')
  const [guardandoLote, setGuardandoLote] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/logistica/ordenes-cen/puntos')
    if (res.ok) setFilas(await res.json())
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!editando) return
    setError('')
    const res = await fetch('/api/logistica/ordenes-cen/puntos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editando) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
    setEditando(null); cargar()
  }

  async function guardarLote() {
    if (!seleccion.size) return
    setError(''); setAviso(''); setGuardandoLote(true)
    try {
      const res = await fetch('/api/logistica/ordenes-cen/puntos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eans: Array.from(seleccion), bodega: bodegaLote }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      setAviso(`Bodega ${bodegaLote || '(sin asignar)'} asignada a ${data.actualizadas} sucursal(es).`)
      setSeleccion(new Set()); cargar()
    } finally { setGuardandoLote(false) }
  }

  const marcar = (eans: string[], marcado: boolean) => setSeleccion(prev => {
    const n = new Set(prev); for (const e of eans) { if (marcado) n.add(e); else n.delete(e) } return n
  })

  const q = buscar.trim().toLowerCase()
  const visibles = filas.filter(f =>
    (!soloConOrdenes || f.ordenes > 0) &&
    (!q || f.ean.includes(q) || f.nit.includes(q) || f.razon_social.toLowerCase().includes(q) || (f.ciudad ?? '').toLowerCase().includes(q)))

  return (
    <div className="cen-page" style={{ maxWidth: 1300 }}>
      <Link href="/logistica/ordenes-cen" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Órdenes EDI</Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>Sucursales</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 880, marginBottom: 12 }}>
        Bodega de despacho de cada sucursal. Al armar el pedido se usa, en este orden: la bodega que traiga Siesa en el maestro del cliente,
        la de la sucursal aquí, la configurada para el cliente y, si no hay ninguna, 00110. La bodega se escoge de la lista de bodegas
        de Siesa (instalación 001).
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input placeholder="Buscar NIT, sucursal, ciudad o EAN" value={buscar} onChange={e => setBuscar(e.target.value)} style={{ ...inp, minWidth: 280, padding: '8px 10px' }} />
        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={soloConOrdenes} onChange={e => setSoloConOrdenes(e.target.checked)} /> Solo sucursales con órdenes
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text2)' }}>{visibles.length} sucursal(es)</span>
      </div>
      {error && <div className="card" style={{ marginBottom: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      {aviso && <div className="card" style={{ marginBottom: 12, color: 'var(--accent2)', fontSize: 13 }}>{aviso}</div>}
      {seleccion.size > 0 && (
        <div className="card" style={{ position: 'sticky', top: 8, zIndex: 5, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--accent)' }}>
          <strong style={{ fontSize: 14 }}>{seleccion.size} sucursal(es) seleccionada(s)</strong>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Bodega:</span>
          <BodegaSelect value={bodegaLote} onChange={setBodegaLote} style={{ ...inp, minWidth: 220, maxWidth: 320, flex: '1 1 220px' }} />
          <button className="btn btn-primary" onClick={guardarLote} disabled={guardandoLote}>
            {guardandoLote ? 'Guardando...' : `Aplicar a ${seleccion.size}`}
          </button>
          <button className="btn" onClick={() => setSeleccion(new Set())} disabled={guardandoLote}>Quitar selección</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="inv-table cen-tabla">
          <thead><tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" title="Seleccionar todas las sucursales visibles" style={{ width: 16, height: 16, cursor: 'pointer' }}
                checked={visibles.length > 0 && visibles.every(f => seleccion.has(f.ean))}
                ref={el => { if (el) el.indeterminate = visibles.some(f => seleccion.has(f.ean)) && !visibles.every(f => seleccion.has(f.ean)) }}
                onChange={e => marcar(visibles.map(f => f.ean), e.target.checked)} />
            </th>
            <th>NIT</th><th>Suc.</th><th>Sucursal</th><th>Ciudad</th><th>EAN entrega</th><th>Órdenes</th><th>Bodega</th><th></th></tr></thead>
          <tbody>
            {visibles.map(f => (
              <tr key={f.ean} style={{ background: seleccion.has(f.ean) ? '#EFF6FF' : undefined }}>
                <td><input type="checkbox" checked={seleccion.has(f.ean)} onChange={e => marcar([f.ean], e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>
                <td>{f.nit}</td><td>{f.sucursal}</td><td>{f.razon_social}</td><td>{f.ciudad ?? '—'}</td>
                <td style={{ fontFamily: 'monospace' }}>{f.ean}</td>
                <td style={{ textAlign: 'right' }}>{f.ordenes}</td>
                <td>
                  {editando?.ean === f.ean
                    ? <BodegaSelect value={editando.bodega} onChange={v => setEditando({ ean: f.ean, bodega: v })} style={{ ...inp, maxWidth: 320 }} />
                    : <strong>{f.bodega ?? <span style={{ color: 'var(--text2)', fontWeight: 400 }}>Sin asignar</span>}</strong>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {editando?.ean === f.ean
                    ? <><button className="btn btn-primary" onClick={guardar}>Guardar</button> <button className="btn" onClick={() => setEditando(null)}>Cancelar</button></>
                    : <button className="btn" onClick={() => { setError(''); setEditando({ ean: f.ean, bodega: f.bodega ?? '' }) }}>Cambiar bodega</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
