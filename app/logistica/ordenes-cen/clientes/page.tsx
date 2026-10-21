'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BodegaSelect } from '@/components/ordenes-cen/BodegaSelect'

type Config = { nit: string; nombre: string | null; id_co: string; tipo_docto: string; bodega: string; ind_precio: string; lista_precio: string | null; cond_pago: string | null }

const vacio: Config = { nit: '', nombre: '', id_co: '001', tipo_docto: 'PVS', bodega: '00110', ind_precio: '2', lista_precio: '', cond_pago: '' }
const inp: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, width: '100%' }

const IND_PRECIO: Record<string, string> = { '0': '0 · Lista del cliente', '1': '1 · Lista del registro', '2': '2 · Precio de la orden' }

export default function ConfigClientesPage() {
  const [filas, setFilas] = useState<Config[]>([])
  const [editando, setEditando] = useState<Config | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch('/api/logistica/ordenes-cen/clientes')
    if (res.ok) setFilas(await res.json())
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!editando) return
    setError('')
    const res = await fetch('/api/logistica/ordenes-cen/clientes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editando) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
    setEditando(null); setAviso('Configuración guardada.'); cargar()
  }

  const campo = (k: keyof Config, ph = '', max = 5) => (
    <input style={inp} maxLength={max} placeholder={ph} value={editando?.[k] ?? ''} onChange={e => setEditando({ ...editando!, [k]: e.target.value })} />
  )

  return (
    <div className="cen-page" style={{ maxWidth: 1300 }}>
      <Link href="/logistica/ordenes-cen" style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>&larr; Órdenes EDI</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '8px 0 16px' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Configuración del pedido por cliente</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 820 }}>
            Valores con los que se arma el pedido en Siesa para cada cadena. La lista de precios y la condición de pago se toman
            del maestro de clientes de Siesa de cada sucursal; llénalas aquí solo si quieres reemplazar la del maestro.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setEditando({ ...vacio }) }}>+ Agregar cliente</button>
      </div>
      {aviso && <div className="card" style={{ marginBottom: 12, color: 'var(--accent2)', fontSize: 13 }}>{aviso}</div>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="inv-table cen-tabla">
          <thead><tr><th>NIT</th><th>Cliente</th><th>C.O.</th><th>Tipo docto</th><th>Bodega</th><th>Indicador de precio</th><th>Lista de precios</th><th>Cond. pago</th><th></th></tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.nit}>
                <td>{f.nit}</td><td>{f.nombre}</td><td>{f.id_co}</td><td>{f.tipo_docto}</td><td>{f.bodega}</td>
                <td>{IND_PRECIO[f.ind_precio]}</td>
                <td>{f.lista_precio || <span style={{ color: 'var(--text2)' }}>La del maestro</span>}</td>
                <td>{f.cond_pago || <span style={{ color: 'var(--text2)' }}>La del maestro</span>}</td>
                <td><button className="btn" onClick={() => { setError(''); setEditando({ ...f, lista_precio: f.lista_precio ?? '', cond_pago: f.cond_pago ?? '' }) }}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <div onClick={() => setEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Configuración del cliente</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
              <label>NIT{campo('nit', '890900608', 15)}</label>
              <label>NOMBRE{campo('nombre', 'Almacenes Éxito', 80)}</label>
              <label>CENTRO DE OPERACIÓN{campo('id_co', '001', 3)}</label>
              <label>TIPO DE DOCUMENTO{campo('tipo_docto', 'PVS', 3)}</label>
              <label>BODEGA (si la sucursal no tiene una)<BodegaSelect value={editando.bodega} onChange={v => setEditando({ ...editando, bodega: v })} style={inp} /></label>
              <label>INDICADOR DE PRECIO
                <select style={inp} value={editando.ind_precio} onChange={e => setEditando({ ...editando, ind_precio: e.target.value })}>
                  {Object.entries(IND_PRECIO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label>LISTA DE PRECIOS (opcional){campo('lista_precio', 'vacío = la del maestro', 3)}</label>
              <label>CONDICIÓN DE PAGO (opcional){campo('cond_pago', 'vacío = la del maestro', 3)}</label>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
