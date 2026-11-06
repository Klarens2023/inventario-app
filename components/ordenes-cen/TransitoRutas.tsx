'use client'
import { useCallback, useEffect, useState } from 'react'
import { codigoRelacion, fechaDespacho } from '@/lib/cen/relacion'

type Ruta = { ruta: string; dias_transito: number; abiertas: number }

// Días de tránsito por ruta: la fecha de despacho de una orden es la entrega menos estos días, y la
// semana del despacho da el consecutivo de la relación (RUTA-MMSS, igual para todas las rutas).
export function TransitoRutas() {
  const [rutas, setRutas] = useState<Ruta[]>([])
  const [cambios, setCambios] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/logistica/ordenes-cen/rutas')
    if (res.ok) setRutas(await res.json())
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    setError(''); setAviso(''); setGuardando(true)
    try {
      for (const [ruta, valor] of Object.entries(cambios)) {
        const res = await fetch('/api/logistica/ordenes-cen/rutas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruta, dias_transito: Number(valor) }) })
        if (!res.ok) { setError(`${ruta}: ${(await res.json()).error ?? 'No se pudo guardar'}`); return }
      }
      setAviso(`Días de tránsito guardados (${Object.keys(cambios).length} ruta(s)). Las relaciones de las órdenes se recalculan solas.`)
      setCambios({}); cargar()
    } finally { setGuardando(false) }
  }

  // Ejemplo con una entrega el próximo lunes, para ver cómo cambia la relación
  const hoy = new Date(); const lunes = new Date(hoy); lunes.setDate(hoy.getDate() + ((8 - hoy.getDay()) % 7 || 7))
  const ejemplo = lunes.toLocaleDateString('en-CA')

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div onClick={() => setAbierto(a => !a)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{abierto ? '▾' : '▸'} Días de tránsito por ruta</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 860 }}>
            El consecutivo de la relación (RUTA-MMSS) sale de la semana de <strong>despacho</strong>: despacho = entrega − días de tránsito de la ruta.
            Ej.: si DISTRYCAR tiene 3 días, una entrega del lunes sale el viernes anterior y queda en la relación de esa semana.
          </div>
        </div>
      </div>
      {abierto && (
        <div style={{ marginTop: 12 }}>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
          {aviso && <div style={{ color: 'var(--accent2)', fontSize: 13, marginBottom: 8 }}>{aviso}</div>}
          <div className="cen-scroll"><table className="inv-table cen-tabla">
            <thead><tr><th>Ruta</th><th style={{ width: 130 }}>Días de tránsito</th><th>Ejemplo: entrega {ejemplo}</th><th style={{ textAlign: 'right' }}>Órdenes abiertas</th></tr></thead>
            <tbody>{rutas.map(r => {
              const valor = cambios[r.ruta] ?? String(r.dias_transito)
              const despacho = fechaDespacho(ejemplo, Number(valor) || 0)
              return (
                <tr key={r.ruta} style={{ background: cambios[r.ruta] !== undefined ? '#EFF6FF' : undefined }}>
                  <td><strong>{r.ruta}</strong></td>
                  <td><input type="number" min={0} max={30} value={valor} onChange={e => setCambios(c => ({ ...c, [r.ruta]: e.target.value }))}
                    style={{ width: 80, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }} /></td>
                  <td className="nw">sale {despacho} → <strong>{codigoRelacion(r.ruta, despacho)}</strong></td>
                  <td className="num">{r.abiertas}</td>
                </tr>
              )
            })}</tbody>
          </table></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            {Object.keys(cambios).length > 0 && <button className="btn" onClick={() => setCambios({})}>Descartar cambios</button>}
            <button className="btn btn-primary" onClick={guardar} disabled={guardando || !Object.keys(cambios).length}>{guardando ? 'Guardando...' : 'Guardar días de tránsito'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
