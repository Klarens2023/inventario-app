'use client'
import { useEffect, useState } from 'react'

type Bodega = { id: string; descripcion: string; activa: boolean }

// Las bodegas se consultan una sola vez por carga de página (lista de Siesa, instalación 001).
let cache: Promise<Bodega[]> | null = null
function cargarBodegas(): Promise<Bodega[]> {
  cache ??= fetch('/api/logistica/ordenes-cen/bodegas').then(async r => {
    const d = await r.json()
    if (!r.ok) { cache = null; throw new Error(d.error ?? 'No se pudieron cargar las bodegas') }
    return d as Bodega[]
  })
  return cache
}

// Selector de bodega de Siesa. Muestra solo las activas, más la actual aunque esté inactiva.
export function BodegaSelect({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  const [bodegas, setBodegas] = useState<Bodega[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { cargarBodegas().then(setBodegas).catch(e => setError(e.message)) }, [])

  if (error) return <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>
  if (!bodegas) return <span style={{ color: 'var(--text2)', fontSize: 12 }}>Cargando bodegas de Siesa...</span>
  const visibles = bodegas.filter(b => b.activa || b.id === value)
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      {!visibles.some(b => b.id === value) && <option value={value}>{value || 'Seleccione...'}</option>}
      {visibles.map(b => <option key={b.id} value={b.id}>{b.id} · {b.descripcion}{b.activa ? '' : ' (inactiva)'}</option>)}
    </select>
  )
}
