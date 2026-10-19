'use client'
import { useEffect, useState } from 'react'

type Item = { f120_id: number; referencia: string; descripcion: string; codigo_anterior: string | null; unidad: string }

// Buscador de ítems de venta de Siesa (copia local de API_v2_Items) por nombre, referencia,
// código anterior o número de ítem.
export function ItemSiesaPicker({ value, onChange, sugerencia }: { value: string; onChange: (id: string) => void; sugerencia?: string }) {
  const [buscar, setBuscar] = useState(sugerencia ?? '')
  const [items, setItems] = useState<Item[]>([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      setCargando(true)
      try {
        const res = await fetch(`/api/logistica/ordenes-cen/items?buscar=${encodeURIComponent(buscar)}`)
        if (res.ok) setItems((await res.json()).items)
      } finally { setCargando(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [buscar])

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar ítem de Siesa: nombre, referencia o código"
        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }} />
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
        {cargando && <div style={{ padding: 8, fontSize: 12, color: 'var(--text2)' }}>Buscando...</div>}
        {!cargando && items.length === 0 && <div style={{ padding: 8, fontSize: 12, color: 'var(--text2)' }}>Sin resultados</div>}
        {items.map(i => (
          <button key={i.f120_id} type="button" onClick={() => onChange(String(i.f120_id))}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12,
              background: String(i.f120_id) === value ? '#E0ECFF' : '#fff', color: 'var(--text)' }}>
            <strong>{i.f120_id}</strong> · {i.descripcion}
            <span style={{ color: 'var(--text2)' }}> · ref {i.referencia}{i.codigo_anterior ? ` · cód. anterior ${i.codigo_anterior}` : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
