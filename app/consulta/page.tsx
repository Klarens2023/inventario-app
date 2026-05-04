'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

type Row = {
  id: number; conteo_id: number | null
  fecha: string; referencia: string; descripcion: string
  localizacion: string; um: string; categoria: string; tipo: string
  cantidad_sistema: number; costo_unitario: number; costo_bodega: number
  conteo_fisico: number; diferencia: number; costo_diferencia: number
  observaciones: string
}

type EditState = { conteo: string; obs: string; status: 'idle' | 'saving' | 'saved' | 'error' }

function fmt(n: number, prefix = '$') {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const s = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
  return (n < 0 ? `-${prefix}` : prefix) + s
}

export default function ConsultaPage() {
  const [fechas,    setFechas]    = useState<string[]>([])
  const [fecha,     setFecha]     = useState('')
  const [rows,      setRows]      = useState<Row[]>([])
  const [loading,   setLoading]   = useState(false)
  const [acumulando, setAcum]     = useState(false)
  const [edits,     setEdits]     = useState<Record<number, EditState>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // ── Cargar fechas disponibles ─────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/inventario').then(r => r.json()).then((data: {fecha:string}[]) => {
      const fs = data.map(d => d.fecha)
      setFechas(fs)
      if (fs.length > 0) setFecha(fs[0])
    })
  }, [])

  // ── Cargar filas al cambiar fecha ─────────────────────────────────────────
  useEffect(() => {
    if (!fecha) return
    setLoading(true)
    fetch(`/api/inventario?fecha=${fecha}`)
      .then(r => r.json())
      .then((data: Row[]) => {
        const init: Record<number, EditState> = {}
        data.forEach(r => {
          init[r.id] = {
            conteo: r.conteo_fisico > 0 ? String(r.conteo_fisico) : '',
            obs:    r.observaciones || '',
            status: 'idle'
          }
        })
        setRows(data)
        setEdits(init)
        setLoading(false)
      })
  }, [fecha])

  // ── Autoguardar con debounce ──────────────────────────────────────────────
  const autoguardar = useCallback((id: number, conteo: string, obs: string) => {
    // Marca como "pendiente"
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'saving' } }))

    // Cancela timer previo de esta fila
    if (timers.current[id]) clearTimeout(timers.current[id])

    // Espera 1 segundo sin cambios antes de guardar
    timers.current[id] = setTimeout(async () => {
      try {
        await fetch('/api/conteo', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_inventario: id,
            conteo_fisico: conteo !== '' ? Number(conteo) : null,
            observaciones: obs || null,
          })
        })
        setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'saved' } }))
        // Borra el ícono de guardado después de 2 segundos
        setTimeout(() => {
          setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'idle' } }))
        }, 2000)
      } catch {
        setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'error' } }))
      }
    }, 1000)
  }, [])

  function handleChange(id: number, field: 'conteo' | 'obs', value: string) {
    const current = edits[id]
    const next = { ...current, [field]: value }
    setEdits(prev => ({ ...prev, [id]: { ...next, status: 'saving' } }))
    autoguardar(id, field === 'conteo' ? value : current.conteo, field === 'obs' ? value : current.obs)
  }

  // ── Botón Acumular (guarda todo lo pendiente y confirma) ──────────────────
  async function acumular() {
    const pendientes = Object.entries(edits).filter(([, e]) => e.status === 'saving')
    if (pendientes.length > 0) {
      const ok = confirm('Hay cambios que se están guardando. ¿Espera un momento y vuelve a intentarlo?')
      return
    }

    const confirmado = confirm(
      `¿Enviar ${rows.length} registros a Acumulados?\n\nEsta acción consolida el conteo físico actual.`
    )
    if (!confirmado) return

    setAcum(true)
    // Guarda forzado de todos (por si hay alguno en 'idle' sin guardar aún)
    for (const row of rows) {
      const e = edits[row.id]
      if (!e) continue
      await fetch('/api/conteo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_inventario: row.id,
          conteo_fisico: e.conteo !== '' ? Number(e.conteo) : null,
          observaciones: e.obs || null,
        })
      })
    }
    setAcum(false)
    alert(`¡Listo! ${rows.length} registros acumulados correctamente para el ${new Date(String(fecha).substring(0, 10) + 'T12:00:00').toLocaleDateString('es-CO')}.`)
  }

  // ── Indicador de estado por fila ──────────────────────────────────────────
  function StatusIcon({ status }: { status: EditState['status'] }) {
    if (status === 'saving') return <span title="Guardando..." style={{ color: 'var(--warn)', fontSize: 11 }}>⏳</span>
    if (status === 'saved')  return <span title="Guardado"   style={{ color: 'var(--accent)', fontSize: 11 }}>✓</span>
    if (status === 'error')  return <span title="Error"      style={{ color: 'var(--danger)', fontSize: 11 }}>✗</span>
    return null
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalBodega = rows.reduce((s, r) => s + Number(r.costo_bodega), 0)
  const totalDif = rows.reduce((s, r) => {
    const c = edits[r.id]?.conteo !== '' ? Number(edits[r.id]?.conteo ?? 0) : 0
    return s + (c - Number(r.cantidad_sistema)) * Number(r.costo_unitario)
  }, 0)

  const hayPendientes = Object.values(edits).some(e => e.status === 'saving')

  return (
    <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>📋 Conteo Físico</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
            Los cambios se guardan automáticamente. Cuando termines, presiona Acumular.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Selector de fecha */}
          <select
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={{
              padding: '8px 12px', background: 'var(--bg3)',
              border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text)', fontSize: 13, fontFamily: 'inherit'
            }}
          >
            {fechas.map(f => (
  <option key={f} value={f}>
    {new Date(String(f).substring(0, 10) + 'T12:00:00').toLocaleDateString('es-CO')}
  </option>
))}
          </select>

          {/* Botón ACUMULAR */}
          <button
            onClick={acumular}
            disabled={acumulando || rows.length === 0 || hayPendientes}
            style={{
              padding: '9px 20px', borderRadius: 6, border: 'none',
              background: hayPendientes ? 'var(--border)' : 'linear-gradient(135deg, #3fb950, #238636)',
              color: hayPendientes ? 'var(--text2)' : '#000',
              fontWeight: 700, fontSize: 14, cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
              opacity: rows.length === 0 ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            {acumulando ? '⏳ Acumulando...' : hayPendientes ? '⏳ Guardando...' : '📊 Acumular todo'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className="stat-card">
          <div className="stat-label">Referencias</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Con conteo</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {Object.values(edits).filter(e => e.conteo !== '').length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Costo Bodega</div>
          <div className="stat-value" style={{ fontSize: 15 }}>{fmt(totalBodega)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Costo Diferencia</div>
          <div className="stat-value" style={{ fontSize: 15, color: totalDif < 0 ? 'var(--danger)' : 'var(--accent)' }}>
            {fmt(totalDif)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Participación</div>
          <div className="stat-value" style={{ color: 'var(--warn)' }}>
            {totalBodega !== 0 ? ((totalDif / totalBodega) * 100).toFixed(1) + '%' : '—'}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
            No hay datos. <a href="/cargar" style={{ color: 'var(--accent)' }}>Cargar inventario</a>
          </div>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Descripción</th>
                <th>Loc.</th>
                <th>U.M</th>
                <th>Cant. Sistema</th>
                <th style={{ color: 'var(--accent)' }}>Conteo Físico</th>
                <th>Diferencia</th>
                <th>Costo Unit.</th>
                <th>Costo Dif.</th>
                <th>Costo Bodega</th>
                <th style={{ color: 'var(--accent)' }}>Observaciones</th>
                <th style={{ width: 24 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const e        = edits[r.id] ?? { conteo: '', obs: '', status: 'idle' }
                const conteo   = e.conteo !== '' ? Number(e.conteo) : 0
                const dif      = conteo - Number(r.cantidad_sistema)
                const costoDif = dif * Number(r.costo_unitario)
                return (
                  <tr key={r.id}>
                    <td><span className="mono" style={{ fontSize: 12 }}>{r.referencia}</span></td>
                    <td style={{ maxWidth: 190 }}>{r.descripcion}</td>
                    <td>{r.localizacion}</td>
                    <td>{r.um}</td>
                    <td style={{ textAlign: 'right' }}>{Number(r.cantidad_sistema).toLocaleString('es-CO')}</td>

                    {/* Conteo Físico editable */}
                    <td style={{ background: 'rgba(63,185,80,0.05)' }}>
                      <input
                        type="number"
                        value={e.conteo}
                        onChange={ev => handleChange(r.id, 'conteo', ev.target.value)}
                        placeholder="—"
                        style={{ textAlign: 'right', width: 90 }}
                      />
                    </td>

                    <td style={{ textAlign: 'right' }} className={dif < 0 ? 'neg' : dif > 0 ? 'pos' : ''}>
                      {e.conteo !== '' ? dif.toLocaleString('es-CO') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.costo_unitario)}</td>
                    <td style={{ textAlign: 'right' }} className={costoDif < 0 ? 'neg' : ''}>
                      {e.conteo !== '' ? fmt(costoDif) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.costo_bodega)}</td>

                    {/* Observaciones editable */}
                    <td style={{ background: 'rgba(63,185,80,0.05)', minWidth: 150 }}>
                      <input
                        type="text"
                        value={e.obs}
                        onChange={ev => handleChange(r.id, 'obs', ev.target.value)}
                        placeholder="Observación..."
                      />
                    </td>

                    {/* Indicador de estado autoguardado */}
                    <td style={{ textAlign: 'center', width: 24 }}>
                      <StatusIcon status={e.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}