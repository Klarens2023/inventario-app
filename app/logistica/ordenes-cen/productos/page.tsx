'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ItemSiesaPicker } from '@/components/ordenes-cen/ItemSiesaPicker'

type Producto = { ean: string; f120_id: number | null; codigo_bd: string | null; descripcion: string | null; peso_kg: number | null; und_caja: number | null; en_maestro: boolean; ordenes: number; descripcion_siesa: string | null }
type Form = { ean: string; f120_id: string; descripcion: string; peso_kg: string; und_caja: string; nuevo: boolean }

const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, width: '100%' }

export default function ProductosCenPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [buscar, setBuscar] = useState('')
  const [actualizando, setActualizando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/logistica/ordenes-cen/productos')
    if (res.ok) setProductos(await res.json())
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!form) return
    setError('')
    const res = await fetch('/api/logistica/ordenes-cen/productos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
    setForm(null); setAviso('Producto guardado. El peso de las órdenes abiertas con ese producto se recalculó.'); cargar()
  }

  async function actualizarItems() {
    setActualizando(true); setAviso(''); setError('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/items', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setAviso(`No se pudieron traer los ítems: ${data.error}`)
      else setAviso(`Ítems de Siesa actualizados (${data.items} de venta). Quedan ${data.productosSinItem} producto(s) sin ítem asignado.`)
      cargar()
    } finally { setActualizando(false) }
  }

  const q = buscar.trim().toLowerCase()
  const visibles = productos.filter(p => !q || p.ean.includes(q) || (p.descripcion ?? '').toLowerCase().includes(q) || String(p.f120_id ?? '').includes(q))
  const sinItem = productos.filter(p => p.en_maestro && !p.f120_id).length
  const fuera = productos.filter(p => !p.en_maestro).length

  return (
    <div className="cen-page" style={{ maxWidth: 1300 }}>
      <Link href="/logistica/ordenes-cen" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Órdenes EDI</Link>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>Productos</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 860, marginBottom: 12 }}>
        Código de barras (EAN) de cada producto que llega en las órdenes, con su <strong>ítem de Siesa</strong> (f120_id), peso y unidades por caja.
        El pedido se envía a Siesa con el código de barras; el ítem de Siesa se usa para verificar el precio. Se asigna solo cuando el código
        anterior del producto (el de "BD 2026") coincide con las notas del ítem en Siesa; si no, escógelo en <strong>Editar</strong>.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {sinItem > 0 && <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{sinItem} sin ítem de Siesa</span>}
        {fuera > 0 && <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{fuera} EAN de órdenes que no están en el maestro (sin peso)</span>}
        <button className="btn" onClick={actualizarItems} disabled={actualizando}>{actualizando ? 'Trayendo ítems de Siesa...' : '⟳ Actualizar ítems de Siesa'}</button>
        <input placeholder="Buscar EAN, descripción o ítem" value={buscar} onChange={e => setBuscar(e.target.value)} style={{ ...inp, maxWidth: 320, marginLeft: 'auto' }} />
      </div>
      {aviso && <div className="card" style={{ marginBottom: 12, color: 'var(--accent2)', fontSize: 13 }}>{aviso}</div>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="inv-table cen-tabla">
          <thead><tr><th>EAN</th><th>Descripción</th><th>Ítem Siesa</th><th>Cód. BD 2026</th><th>Peso (kg)</th><th>Und/caja</th><th>Órdenes</th><th></th></tr></thead>
          <tbody>
            {visibles.map(p => (
              <tr key={p.ean} style={{ background: p.en_maestro ? undefined : '#FFF7ED' }}>
                <td style={{ fontFamily: 'monospace' }}>{p.ean}</td>
                <td>{p.descripcion ?? '—'}</td>
                <td>{p.f120_id ? <><strong>{p.f120_id}</strong>{p.descripcion_siesa && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{p.descripcion_siesa}</div>}</> : <span style={{ color: '#B45309', fontWeight: 600 }}>Sin asignar</span>}</td>
                <td style={{ color: 'var(--text2)' }}>{p.codigo_bd ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.peso_kg ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.und_caja ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{p.ordenes}</td>
                <td>
                  <button className="btn" onClick={() => { setError(''); setForm({ ean: p.ean, f120_id: p.f120_id?.toString() ?? '', descripcion: p.descripcion ?? '', peso_kg: p.peso_kg?.toString() ?? '', und_caja: p.und_caja?.toString() ?? '', nuevo: !p.en_maestro }) }}>
                    {p.en_maestro ? 'Editar' : 'Agregar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{form.nuevo ? 'Agregar al maestro' : 'Editar producto'}</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>EAN <strong>{form.ean}</strong></p>
            <div style={{ display: 'grid', gap: 12, fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
              <label>DESCRIPCIÓN<input style={inp} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></label>
              <div>ÍTEM DE SIESA {form.f120_id ? <span style={{ color: 'var(--text)' }}>· seleccionado: <strong>{form.f120_id}</strong></span> : '· sin asignar'}
                <ItemSiesaPicker value={form.f120_id} onChange={id => setForm({ ...form, f120_id: id })} sugerencia={form.descripcion.split(' ').slice(0, 2).join(' ')} />
              </div>
              <label>PESO POR UNIDAD (kg)<input style={inp} value={form.peso_kg} onChange={e => setForm({ ...form, peso_kg: e.target.value })} placeholder="ej. 0.2" /></label>
              <label>UNIDADES POR CAJA<input style={inp} value={form.und_caja} onChange={e => setForm({ ...form, und_caja: e.target.value.replace(/\D/g, '') })} /></label>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
