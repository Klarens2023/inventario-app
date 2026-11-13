'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Cliente = { nit: string; nombre: string; ciudades: string[]; ruta: string; activo: boolean; updated_por?: string | null }

const vacio: Cliente = { nit: '', nombre: '', ciudades: [], ruta: 'DISTRYCAR', activo: true }
const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, width: '100%', background: '#fff' }

// Clientes institucionales cuyos pedidos PVK se agregan solos a una ruta en cada sincronización,
// solo si el punto de envío del pedido está en una de las ciudades del cliente.
export default function ClientesInstitucionalesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [ciudades, setCiudades] = useState<Record<string, string>>({})
  const [rutas, setRutas] = useState<string[]>([])
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [buscando, setBuscando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/logistica/ordenes-cen/institucional/clientes')
    const d = await res.json().catch(() => ({}))
    setClientes(d.clientes ?? []); setCiudades(d.ciudades ?? {}); if (d.error) setError(d.error)
  }, [])
  useEffect(() => {
    cargar()
    fetch('/api/logistica/ordenes-cen/reglas').then(r => r.ok ? r.json() : []).then((rs: { ruta: string }[]) =>
      setRutas(Array.from(new Set(rs.map(r => r.ruta))).sort())).catch(() => {})
  }, [cargar])

  const nombre = (c: string) => ciudades[c] ?? c

  async function guardar() {
    if (!editando) return
    setError('')
    const res = await fetch('/api/logistica/ordenes-cen/institucional/clientes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editando) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d.error ?? 'No se pudo guardar'); return }
    setEditando(null); setAviso('Cliente guardado.'); cargar()
  }
  async function quitar(c: Cliente) {
    if (!window.confirm(`¿Quitar a ${c.nombre} de la búsqueda automática?\n\nLos pedidos que ya se trajeron se quedan en su ruta.`)) return
    const res = await fetch(`/api/logistica/ordenes-cen/institucional/clientes?nit=${c.nit}`, { method: 'DELETE' })
    if (res.ok) { setAviso(`${c.nombre} ya no se busca automáticamente.`); cargar() }
  }
  async function buscarAhora() {
    setBuscando(true); setError(''); setAviso('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/institucional/automatico', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error ?? 'No se pudo buscar'); else setAviso(d.mensaje)
    } finally { setBuscando(false) }
  }
  const alternarCiudad = (c: string) => setEditando(e => e && ({ ...e, ciudades: e.ciudades.includes(c) ? e.ciudades.filter(x => x !== c) : [...e.ciudades, c] }))

  return (
    <div className="cen-page" style={{ maxWidth: 1200 }}>
      <Link href="/logistica/ordenes-cen" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Órdenes EDI</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '8px 0 16px' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Clientes institucionales</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 820 }}>
            En cada sincronización se buscan en Siesa los pedidos <strong>PVK</strong> de los últimos 8 días de estos clientes y se agregan
            solos a su ruta, con la relación de la semana del despacho. Solo entran los pedidos cuyo <strong>punto de envío</strong> está
            en una de las ciudades del cliente (ej. Atlantic en Barranquilla y Cartagena, no en Bogotá). Después se pueden cambiar de ruta
            o de relación, o quitar de la ruta (y no se vuelven a traer).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <button className="btn" onClick={buscarAhora} disabled={buscando}>{buscando ? 'Buscando en Siesa...' : '⟳ Buscar ahora'}</button>
          <button className="btn btn-primary" onClick={() => { setError(''); setEsNuevo(true); setEditando({ ...vacio }) }}>+ Agregar cliente</button>
        </div>
      </div>
      {aviso && <div className="card" style={{ marginBottom: 12, padding: '10px 14px', color: '#047857', fontSize: 13 }}>{aviso}</div>}
      {error && <div className="card" style={{ marginBottom: 12, padding: '10px 14px', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {editando && (
        <div className="card" style={{ marginBottom: 16, display: 'grid', gap: 10 }}>
          <strong>{esNuevo ? 'Nuevo cliente institucional' : `Editar ${editando.nombre}`}</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)' }}>NIT (sin dígito de verificación)
              <input style={inp} value={editando.nit} disabled={!esNuevo} onChange={e => setEditando({ ...editando, nit: e.target.value.replace(/\D/g, '') })} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text2)' }}>Nombre
              <input style={inp} value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text2)' }}>Ruta
              <select style={inp} value={editando.ruta} onChange={e => setEditando({ ...editando, ruta: e.target.value })}>
                {Array.from(new Set([editando.ruta, ...rutas])).filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', marginTop: 18 }}>
              <input type="checkbox" checked={editando.activo} onChange={e => setEditando({ ...editando, activo: e.target.checked })} /> Buscar sus pedidos automáticamente
            </label>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Ciudades del punto de envío que van en la ruta</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {Array.from(new Set([...Object.keys(ciudades), ...editando.ciudades])).map(c => {
                const sel = editando.ciudades.includes(c)
                return (
                  <button key={c} type="button" onClick={() => alternarCiudad(c)}
                    style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                      background: sel ? 'var(--accent)' : '#fff', color: sel ? '#fff' : 'var(--text)' }}>
                    {nombre(c)} <span style={{ fontWeight: 400, opacity: .8 }}>{c}</span>
                  </button>
                )
              })}
              <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Otro código DANE (DD-CCC)" style={{ ...inp, width: 190 }} />
              <button className="btn" disabled={!/^\d{2}-\d{3}$/.test(codigo.trim())} onClick={() => { alternarCiudad(codigo.trim()); setCodigo('') }}>Agregar</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="cen-scroll">
          <table className="inv-table cen-tabla cen-tarjetas">
            <thead><tr><th>Cliente</th><th>Ciudades</th><th>Ruta</th><th>Automático</th><th data-sin-orden></th></tr></thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.nit}>
                  <td data-label="Cliente" className="ancho"><div><strong>{c.nombre}</strong><span className="sub mono">NIT {c.nit}</span></div></td>
                  <td data-label="Ciudades">{c.ciudades.map(nombre).join(', ')}</td>
                  <td data-label="Ruta" className="nw"><strong>{c.ruta}</strong></td>
                  <td data-label="Automático">{c.activo ? <span style={{ color: '#047857', fontWeight: 700 }}>Sí</span> : <span style={{ color: 'var(--text2)' }}>Pausado</span>}</td>
                  <td data-label="" className="nw" style={{ textAlign: 'right' }}>
                    <button className="btn" onClick={() => { setError(''); setEsNuevo(false); setEditando({ ...c }) }}>Editar</button>{' '}
                    <button className="btn btn-danger" onClick={() => quitar(c)}>Quitar</button>
                  </td>
                </tr>
              ))}
              {!clientes.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 24 }}>No hay clientes configurados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
