'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { exportarExcel } from '@/lib/exportExcel'

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
  const [fechas,     setFechas]    = useState<string[]>([])
  const [fecha,      setFecha]     = useState('')
  const [tipos,      setTipos]     = useState<string[]>([])
  const [tipoSel,    setTipoSel]   = useState('todos')
  const [rows,       setRows]      = useState<Row[]>([])
  const [loading,    setLoading]   = useState(false)
  const [acumulando, setAcum]      = useState(false)
  const [edits,      setEdits]     = useState<Record<number, EditState>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // Cargar fechas
  useEffect(() => {
    fetch('/api/inventario').then(r => r.json()).then((data: {fecha:string}[]) => {
      const fs = data.map(d => String(d.fecha).substring(0, 10))
      setFechas(fs)
      if (fs.length > 0) setFecha(fs[0])
    })
  }, [])

  // Cargar tipos disponibles al cambiar fecha
  useEffect(() => {
    if (!fecha) return
    fetch(`/api/inventario/tipos?fecha=${fecha}`)
      .then(r => r.json())
      .then((ts: string[]) => {
        setTipos(ts)
        setTipoSel('todos')
      })
  }, [fecha])

  // Cargar filas al cambiar fecha o tipo
  useEffect(() => {
    if (!fecha) return
    setLoading(true)
    const url = tipoSel !== 'todos'
      ? `/api/inventario?fecha=${fecha}&tipo=${encodeURIComponent(tipoSel)}`
      : `/api/inventario?fecha=${fecha}`
    fetch(url)
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
  }, [fecha, tipoSel])

  const autoguardar = useCallback((id: number, conteo: string, obs: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'saving' } }))
    if (timers.current[id]) clearTimeout(timers.current[id])
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
        setTimeout(() => setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'idle' } })), 2000)
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

  async function acumular() {
    if (Object.values(edits).some(e => e.status === 'saving')) {
      alert('Hay cambios guardándose. Espera un momento.')
      return
    }
    if (!confirm(`Enviar ${rows.length} registros (${tipoSel}) a Acumulados?`)) return
    setAcum(true)
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
    alert(`Listo! ${rows.length} registros acumulados.`)
  }

  function exportar() {
    const cols = ['Referencia','Descripcion','Localizacion','U.M','Categoria','Tipo','Cant. Sistema','Conteo Fisico','Diferencia','Costo Unitario','Costo Diferencia','Costo Bodega','Observaciones']
    const filas = rows.map(r => {
      const e      = edits[r.id]
      const conteo = e?.conteo !== '' ? Number(e?.conteo) : 0
      const dif    = conteo - Number(r.cantidad_sistema)
      return [
        r.referencia, r.descripcion, r.localizacion, r.um,
        r.categoria, r.tipo,
        Number(r.cantidad_sistema),
        conteo || '',
        dif || '',
        Number(r.costo_unitario),
        dif * Number(r.costo_unitario) || '',
        Number(r.costo_bodega),
        e?.obs || ''
      ]
    })
    exportarExcel(`Conteo_${tipoSel}_${fecha}`, cols, filas)
  }

  const totalBodega = rows.reduce((s, r) => s + Number(r.costo_bodega), 0)
  const totalDif    = rows.reduce((s, r) => {
    const c = edits[r.id]?.conteo !== '' ? Number(edits[r.id]?.conteo ?? 0) : 0
    return s + (c - Number(r.cantidad_sistema)) * Number(r.costo_unitario)
  }, 0)
  const hayPendientes = Object.values(edits).some(e => e.status === 'saving')

  function StatusIcon({ status }: { status: EditState['status'] }) {
    if (status === 'saving') return <span style={{ color: 'var(--warn)', fontSize: 11 }}>⏳</span>
    if (status === 'saved')  return <span style={{ color: 'var(--accent)', fontSize: 11 }}>✓</span>
    if (status === 'error')  return <span style={{ color: 'var(--danger)', fontSize: 11 }}>✗</span>
    return null
  }

  return (
    <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Conteo Fisico</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
            Los cambios se guardan automaticamente. Cuando termines presiona Acumular.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* Fecha */}
          <select value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
            {fechas.map(f => (
              <option key={f} value={f}>
                {new Date(f + 'T12:00:00').toLocaleDateString('es-CO')}
              </option>
            ))}
          </select>

          {/* Sub-categoría (tipo) */}
          <select value={tipoSel} onChange={e => setTipoSel(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}>
            <option value="todos">Todos los tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Exportar */}
          <button onClick={exportar} disabled={rows.length === 0} className="btn"
            style={{ fontSize: 12, opacity: rows.length === 0 ? 0.5 : 1 }}>
            Exportar Excel
          </button>

          {/* Acumular */}
          <button onClick={acumular} disabled={acumulando || rows.length === 0 || hayPendientes}
            style={{
              padding: '9px 20px', borderRadius: 6, border: 'none',
              background: hayPendientes ? 'var(--border)' : 'linear-gradient(135deg, #3fb950, #238636)',
              color: hayPendientes ? 'var(--text2)' : '#000',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              opacity: rows.length === 0 ? 0.5 : 1
            }}>
            {acumulando ? 'Acumulando...' : hayPendientes ? 'Guardando...' : 'Acumular todo'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div className="stat-card"><div className="stat-label">Referencias</div><div className="stat-value">{rows.length}</div></div>
        <div className="stat-card"><div className="stat-label">Con conteo</div><div className="stat-value" style={{ color: 'var(--accent)' }}>{Object.values(edits).filter(e => e.conteo !== '').length}</div></div>
        <div className="stat-card"><div className="stat-label">Costo Bodega</div><div className="stat-value" style={{ fontSize: 14 }}>{fmt(totalBodega)}</div></div>
        <div className="stat-card"><div className="stat-label">Costo Diferencia</div><div className="stat-value" style={{ fontSize: 14, color: totalDif < 0 ? 'var(--danger)' : 'var(--accent)' }}>{fmt(totalDif)}</div></div>
        <div className="stat-card"><div className="stat-label">Participacion</div><div className="stat-value" style={{ color: 'var(--warn)' }}>{totalBodega !== 0 ? ((totalDif / totalBodega) * 100).toFixed(1) + '%' : '—'}</div></div>
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
                <th>Descripcion</th>
                <th>Loc.</th>
                <th>U.M</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Cant. Sistema</th>
                <th style={{ color: 'var(--accent)' }}>Conteo Fisico</th>
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
                const e        = edits[r.id] ?? { conteo: '', obs: '', status: 'idle' as const }
                const conteo   = e.conteo !== '' ? Number(e.conteo) : 0
                const dif      = conteo - Number(r.cantidad_sistema)
                const costoDif = dif * Number(r.costo_unitario)
                return (
                  <tr key={r.id}>
                    <td><span className="mono" style={{ fontSize: 12 }}>{r.referencia}</span></td>
                    <td style={{ maxWidth: 180 }}>{r.descripcion}</td>
                    <td>{r.localizacion}</td>
                    <td>{r.um}</td>
                    <td style={{ fontSize: 11, color: 'var(--text2)' }}>{r.categoria}</td>
                    <td><span style={{ background: 'var(--bg3)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{r.tipo}</span></td>
                    <td style={{ textAlign: 'right' }}>{Number(r.cantidad_sistema).toLocaleString('es-CO')}</td>
                    <td style={{ background: 'rgba(63,185,80,0.05)' }}>
                      <input type="number" value={e.conteo}
                        onChange={ev => handleChange(r.id, 'conteo', ev.target.value)}
                        placeholder="—" style={{ textAlign: 'right', width: 90 }} />
                    </td>
                    <td style={{ textAlign: 'right' }} className={dif < 0 ? 'neg' : dif > 0 ? 'pos' : ''}>
                      {e.conteo !== '' ? dif.toLocaleString('es-CO') : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.costo_unitario)}</td>
                    <td style={{ textAlign: 'right' }} className={costoDif < 0 ? 'neg' : ''}>
                      {e.conteo !== '' ? fmt(costoDif) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.costo_bodega)}</td>
                    <td style={{ background: 'rgba(63,185,80,0.05)', minWidth: 140 }}>
                      <input type="text" value={e.obs}
                        onChange={ev => handleChange(r.id, 'obs', ev.target.value)}
                        placeholder="Observacion..." />
                    </td>
                    <td style={{ textAlign: 'center' }}><StatusIcon status={e.status} /></td>
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