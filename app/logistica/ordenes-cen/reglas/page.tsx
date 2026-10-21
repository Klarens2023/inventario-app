'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ReglaRuta } from '@/lib/cen/rutas'
import { COMPRADORES, nombreComprador } from '@/lib/cen/compradores'

type Form = { id?: number; prioridad: string; ruta: string; ean_comprador: string; ciudades: string; departamentos: string; peso_min: string; peso_max: string; descripcion: string; activo: boolean }

const vacio: Form = { prioridad: '100', ruta: '', ean_comprador: '', ciudades: '', departamentos: '', peso_min: '', peso_max: '', descripcion: '', activo: true }
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, width: '100%' }
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'grid', gap: 4 }

export default function ReglasRutaPage() {
  const [reglas, setReglas] = useState<ReglaRuta[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/logistica/ordenes-cen/reglas')
    if (res.ok) setReglas(await res.json())
  }, [])
  useEffect(() => { cargar() }, [cargar])

  function editar(r: ReglaRuta) {
    setError('')
    setForm({
      id: r.id, prioridad: String(r.prioridad), ruta: r.ruta, ean_comprador: r.ean_comprador ?? '',
      ciudades: r.ciudades.join(', '), departamentos: r.departamentos.join(', '),
      peso_min: r.peso_min?.toString() ?? '', peso_max: r.peso_max?.toString() ?? '', descripcion: r.descripcion ?? '', activo: r.activo,
    })
  }

  async function guardar() {
    if (!form) return
    setError(''); setGuardando(true)
    try {
      const res = await fetch(`/api/logistica/ordenes-cen/reglas${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      setForm(null); setAviso(`Regla guardada. ${data.ordenesRecalculadas} orden(es) cambiaron de ruta sugerida.`); cargar()
    } finally { setGuardando(false) }
  }

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar esta regla?')) return
    const res = await fetch(`/api/logistica/ordenes-cen/reglas/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { setAviso(`Regla eliminada. ${data.ordenesRecalculadas} orden(es) cambiaron de ruta sugerida.`); cargar() }
  }

  return (
    <div className="cen-page" style={{ maxWidth: 1400 }}>
      <Link href="/logistica/ordenes-cen" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Órdenes EDI</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', margin: '8px 0 16px' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Reglas de ruta</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 820 }}>
            A cada orden se le sugiere la ruta de la primera regla (de menor a mayor prioridad) que cumpla: cadena, ciudad o
            departamento del punto de entrega y, si se define, el rango de peso de la orden. La ruta de una orden siempre se puede
            cambiar a mano, y esa ruta manual no la cambian las reglas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setForm({ ...vacio }) }}>+ Nueva regla</button>
      </div>
      {aviso && <div className="card" style={{ marginBottom: 12, color: 'var(--accent2)', fontSize: 13 }}>{aviso}</div>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="inv-table cen-tabla">
          <thead><tr><th>Prioridad</th><th>Ruta</th><th>Cadena</th><th>Ciudades / departamentos</th><th>Peso (kg)</th><th>Descripción</th><th>Activa</th><th></th></tr></thead>
          <tbody>
            {reglas.map(r => (
              <tr key={r.id} style={{ opacity: r.activo ? 1 : 0.5 }}>
                <td style={{ textAlign: 'right' }}>{r.prioridad}</td>
                <td style={{ fontWeight: 800 }}>{r.ruta}</td>
                <td>{r.ean_comprador ? nombreComprador(r.ean_comprador) : 'Todas'}</td>
                <td style={{ fontSize: 12, maxWidth: 420 }}>
                  {[...r.ciudades, ...r.departamentos.map(d => `Depto. ${d}`)].join(', ') || <em>Cualquier lugar</em>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {r.peso_min === null && r.peso_max === null ? '—' : `${r.peso_min ?? 0} a ${r.peso_max ?? '∞'}`}
                </td>
                <td style={{ fontSize: 12 }}>{r.descripcion}</td>
                <td>{r.activo ? 'Sí' : 'No'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn" onClick={() => editar(r)}>Editar</button>{' '}
                  <button className="btn btn-danger" onClick={() => eliminar(r.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 620 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>{form.id ? 'Editar regla' : 'Nueva regla'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={lbl}>RUTA<input style={inp} value={form.ruta} onChange={e => setForm({ ...form, ruta: e.target.value.toUpperCase() })} placeholder="DISTRYCAR" /></label>
              <label style={lbl}>PRIORIDAD (menor se evalúa primero)<input style={inp} type="number" value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value })} /></label>
              <label style={{ ...lbl, gridColumn: '1 / -1' }}>CADENA
                <select style={inp} value={form.ean_comprador} onChange={e => setForm({ ...form, ean_comprador: e.target.value })}>
                  <option value="">Todas las cadenas</option>
                  {Object.entries(COMPRADORES).map(([ean, n]) => <option key={ean} value={ean}>{n}</option>)}
                </select>
              </label>
              <label style={{ ...lbl, gridColumn: '1 / -1' }}>CIUDADES (separadas por coma; vacío = cualquiera)
                <textarea style={{ ...inp, minHeight: 60 }} value={form.ciudades} onChange={e => setForm({ ...form, ciudades: e.target.value })} placeholder="Barranquilla, Soledad, Santa Marta" />
              </label>
              <label style={{ ...lbl, gridColumn: '1 / -1' }}>DEPARTAMENTOS (separados por coma)
                <input style={inp} value={form.departamentos} onChange={e => setForm({ ...form, departamentos: e.target.value })} placeholder="La Guajira" />
              </label>
              <label style={lbl}>PESO MÍNIMO (kg)<input style={inp} value={form.peso_min} onChange={e => setForm({ ...form, peso_min: e.target.value })} placeholder="vacío = sin mínimo" /></label>
              <label style={lbl}>PESO MÁXIMO (kg)<input style={inp} value={form.peso_max} onChange={e => setForm({ ...form, peso_max: e.target.value })} placeholder="vacío = sin máximo" /></label>
              <label style={{ ...lbl, gridColumn: '1 / -1' }}>DESCRIPCIÓN<input style={inp} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></label>
              <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Regla activa
              </label>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
