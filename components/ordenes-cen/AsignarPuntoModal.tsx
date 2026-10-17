'use client'
import { useState } from 'react'

const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, width: '100%' }

// Homologa un EAN de punto de entrega con la sucursal de Siesa. Se hace una sola
// vez por tienda: las siguientes órdenes con ese EAN entran ya asociadas.
export function AsignarPuntoModal({ ean, onClose, onGuardado }: { ean: string; onClose: () => void; onGuardado: (n: number) => void }) {
  const [nit, setNit] = useState('')
  const [sucursal, setSucursal] = useState('')
  const [razon, setRazon] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setError(''); setGuardando(true)
    try {
      const res = await fetch('/api/logistica/ordenes-cen/puntos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ean, nit, sucursal, razon_social: razon }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      onGuardado(data.ordenesActualizadas)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 440 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Asignar sucursal de Siesa</h2>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>
          EAN del punto de entrega <strong>{ean}</strong>. Al guardarlo, todas sus órdenes quedan asociadas y las próximas entran solas.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>NIT DEL CLIENTE
            <input value={nit} onChange={e => setNit(e.target.value.replace(/\D/g, ''))} style={inp} placeholder="890900608" />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>SUCURSAL
            <input value={sucursal} onChange={e => setSucursal(e.target.value)} maxLength={3} style={inp} placeholder="001" />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>RAZÓN SOCIAL DE LA SUCURSAL
            <input value={razon} onChange={e => setRazon(e.target.value)} maxLength={100} style={inp} placeholder="ALMACENES EXITO CEDI VEGAS" />
          </label>
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando || !nit || !sucursal || !razon}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
