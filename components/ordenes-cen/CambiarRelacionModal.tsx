'use client'
import { useEffect, useMemo, useState } from 'react'
import { codigoRelacion } from '@/lib/cen/relacion'
import { fmtFecha } from './utils'

type Relacion = { relacion: string; ruta: string; fecha_despacho: string; ordenes: number }

// Mueve una o varias órdenes a otra relación de despacho (puede ser de otra ruta): se elige una de las
// relaciones activas o se arma con ruta + fecha de despacho. API: /api/logistica/ordenes-cen/relaciones.
export function CambiarRelacionModal({ ids, actual, onClose, onCambiado }: {
  ids: number[]
  actual?: string | null // relación actual (si es una sola orden o todas comparten relación)
  onClose: () => void
  onCambiado: (mensaje: string) => void
}) {
  const [relaciones, setRelaciones] = useState<Relacion[] | null>(null)
  const [rutas, setRutas] = useState<string[]>([])
  const [buscar, setBuscar] = useState('')
  const [ruta, setRuta] = useState('')
  const [fecha, setFecha] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/logistica/ordenes-cen/relaciones').then(r => r.ok ? r.json() : []).then(setRelaciones).catch(() => setRelaciones([]))
    fetch('/api/logistica/ordenes-cen/reglas').then(r => r.ok ? r.json() : []).then((rs: { ruta: string }[]) =>
      setRutas(Array.from(new Set(rs.map(r => r.ruta))).sort())).catch(() => {})
  }, [])

  const destino = codigoRelacion(ruta.trim().toUpperCase() || null, fecha || null)
  const visibles = useMemo(() => (relaciones ?? []).filter(r => r.relacion.includes(buscar.trim().toUpperCase())), [relaciones, buscar])

  async function mover() {
    if (!destino) return
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/relaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ruta: ruta.trim().toUpperCase(), fecha_despacho: fecha }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'No se pudo cambiar la relación'); return }
      onCambiado(d.mensaje ?? `Órdenes movidas a ${destino}.`)
    } finally { setGuardando(false) }
  }

  const campo: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div onClick={e => e.stopPropagation()} className="card" role="dialog" aria-modal="true" aria-label="Cambiar de relación"
        style={{ width: '100%', maxWidth: 620, maxHeight: '94vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Cambiar de relación</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 12px' }}>
          {ids.length === 1 ? 'La orden' : `Las ${ids.length} órdenes`}{actual ? <> de <strong>{actual}</strong></> : ''} pasan a la relación que elijas, aunque sea de otra ruta.
          Quedan con la ruta y la fecha de despacho de esa relación fijadas a mano.
        </p>

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Relaciones activas</div>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar relación (ej. EXCAL-1146)" style={{ ...campo, width: '100%', marginBottom: 8 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 14 }}>
          {relaciones === null && <span style={{ fontSize: 13, color: 'var(--text2)' }}>Cargando...</span>}
          {relaciones && !visibles.length && <span style={{ fontSize: 13, color: 'var(--text2)' }}>No hay relaciones activas con ese nombre: ármala abajo.</span>}
          {visibles.map(r => {
            const elegida = destino === r.relacion
            return (
              <button key={r.relacion} type="button" disabled={r.relacion === actual}
                onClick={() => { setRuta(r.ruta); setFecha(r.fecha_despacho) }}
                title={`${r.ordenes} orden(es) · despacho desde ${fmtFecha(r.fecha_despacho)}`}
                style={{ padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: r.relacion === actual ? 'not-allowed' : 'pointer',
                  border: `1px solid ${elegida ? 'var(--accent)' : 'var(--border)'}`, background: elegida ? 'var(--accent)' : '#fff', color: elegida ? '#fff' : 'var(--text)', opacity: r.relacion === actual ? 0.45 : 1 }}>
                {r.relacion} <span style={{ fontWeight: 400 }}>· {r.ordenes}</span>
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>O arma la relación</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input list="rutas-relacion" value={ruta} onChange={e => setRuta(e.target.value.toUpperCase())} placeholder="Ruta" style={{ ...campo, width: 150 }} />
          <datalist id="rutas-relacion">{rutas.map(r => <option key={r} value={r} />)}</datalist>
          <label style={{ fontSize: 12, color: 'var(--text2)' }}>Despacho <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={campo} /></label>
        </div>

        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 12 }}>
          Nueva relación: <strong>{destino ?? '—'}</strong>
          {destino && destino === actual && <span style={{ color: '#B45309', fontSize: 12 }}> · es la misma relación actual</span>}
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button className="btn btn-primary" onClick={mover} disabled={!destino || destino === actual || guardando}>
            {guardando ? 'Moviendo...' : `Mover ${ids.length > 1 ? `${ids.length} órdenes` : 'orden'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
