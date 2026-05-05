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

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none',
  color: 'inherit', fontFamily: 'inherit', fontSize: 13,
  outline: 'none', padding: '2px 4px', cursor: 'text'
}

export default function ConsultaPage() {
  const [fechas,     setFechas]  = useState<string[]>([])
  const [fecha,      setFecha]   = useState('')
  const [tipos,      setTipos]   = useState<string[]>([])
  const [tipoSel,    setTipoSel] = useState('todos')
  const [rows,       setRows]    = useState<Row[]>([])
  const [loading,    setLoading] = useState(false)
  const [acumulando, setAcum]    = useState(false)
  const [edits,      setEdits]   = useState<Record<number, EditState>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    fetch('/api/inventario').then(r => r.json()).then((data: {fecha:string}[]) => {
      const fs = data.map(d => String(d.fecha).substring(0, 10))
      setFechas(fs)
      if (fs.length > 0) setFecha(fs[0])
    })
  }, [])

  useEffect(() => {
    if (!fecha) return
    fetch(`/api/inventario/tipos?fecha=${fecha}`)
      .then(r => r.json()).then((ts: string[]) => { setTipos(ts); setTipoSel('todos') })
  }, [fecha])

  useEffect(() => {
    if (!fecha) return
    setLoading(true)
    const url = tipoSel !== 'todos'
      ? `/api/inventario?fecha=${fecha}&tipo=${encodeURIComponent(tipoSel)}`
      : `/api/inventario?fecha=${fecha}`
    fetch(url).then(r => r.json()).then((data: Row[]) => {
      const init: Record<number, EditState> = {}
      data.forEach(r => { init[r.id] = { conteo: r.conteo_fisico > 0 ? String(r.conteo_fisico) : '', obs: r.observaciones || '', status: 'idle' } })
      setRows(data); setEdits(init); setLoading(false)
    })
  }, [fecha, tipoSel])

  const autoguardar = useCallback((id: number, conteo: string, obs: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'saving' } }))
    if (timers.current[id]) clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(async () => {
      try {
        await fetch('/api/conteo', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_inventario: id, conteo_fisico: conteo !== '' ? Number(conteo) : null, observaciones: obs || null }) })
        setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'saved' } }))
        setTimeout(() => setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'idle' } })), 2000)
      } catch { setEdits(prev => ({ ...prev, [id]: { ...prev[id], status: 'error' } })) }
    }, 1000)
  }, [])

  function handleChange(id: number, field: 'conteo' | 'obs', value: string) {
    const current = edits[id]
    setEdits(prev => ({ ...prev, [id]: { ...current, [field]: value, status: 'saving' } }))
    autoguardar(id, field === 'conteo' ? value : current.conteo, field === 'obs' ? value : current.obs)
  }

  async function acumular() {
    if (Object.values(edits).some(e => e.status === 'saving')) { alert('Hay cambios guardandose. Espera un momento.'); return }
    if (!confirm(`Enviar ${rows.length} registros a Acumulados?`)) return
    setAcum(true)
    for (const row of rows) {
      const e = edits[row.id]; if (!e) continue
      await fetch('/api/conteo', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_inventario: row.id, conteo_fisico: e.conteo !== '' ? Number(e.conteo) : null, observaciones: e.obs || null }) })
    }
    setAcum(false); alert(`Listo! ${rows.length} registros acumulados.`)
  }

  function exportar() {
    const cols = ['Referencia','Descripcion','Loc','UM','Tipo','Cant Sistema','Conteo Fisico','Diferencia','Costo Unitario','Costo Diferencia','Costo Bodega','Observaciones']
    const filas = rows.map(r => {
      const e = edits[r.id]; const conteo = e?.conteo !== '' ? Number(e?.conteo) : 0; const dif = conteo - Number(r.cantidad_sistema)
      return [r.referencia, r.descripcion, r.localizacion, r.um, r.tipo, Number(r.cantidad_sistema), conteo || '', dif || '', Number(r.costo_unitario), dif * Number(r.costo_unitario) || '', Number(r.costo_bodega), e?.obs || '']
    })
    exportarExcel(`Conteo_${tipoSel}_${fecha}`, cols, filas as any)
  }

  const totalBodega = rows.reduce((s, r) => s + Number(r.costo_bodega), 0)
  const totalDif    = rows.reduce((s, r) => {
    const c = edits[r.id]?.conteo !== '' ? Number(edits[r.id]?.conteo ?? 0) : 0
    return s + (c - Number(r.cantidad_sistema)) * Number(r.costo_unitario)
  }, 0)
  const hayPendientes = Object.values(edits).some(e => e.status === 'saving')

  function StatusDot({ status }: { status: EditState['status'] }) {
    if (status === 'saving') return <span style={{ color: '#f59e0b', fontSize: 10 }}>●</span>
    if (status === 'saved')  return <span style={{ color: '#10b981', fontSize: 10 }}>✓</span>
    if (status === 'error')  return <span style={{ color: '#ef4444', fontSize: 10 }}>✗</span>
    return null
  }

  // ── select / button styles (reutilizables) ──
  const selStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
    background: '#fff', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer'
  }
  const btnGreen: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: hayPendientes ? '#9ca3af' : 'linear-gradient(135deg,#22c55e,#16a34a)',
    color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit'
  }

  return (
    // ── Wrapper que ocupa TODA la viewport menos el sidebar ──
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: '20px 24px', gap: 12, boxSizing: 'border-box' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Conteo Fisico</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Los cambios se guardan automaticamente. Cuando termines presiona Acumular.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={fecha} onChange={e => setFecha(e.target.value)} style={selStyle}>
            {fechas.map(f => <option key={f} value={f}>{new Date(f + 'T12:00:00').toLocaleDateString('es-CO')}</option>)}
          </select>
          <select value={tipoSel} onChange={e => setTipoSel(e.target.value)} style={selStyle}>
            <option value="todos">Todos los tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={exportar} disabled={rows.length === 0} style={{ ...selStyle, background: '#f3f4f6', fontWeight: 600 }}>
            Exportar Excel
          </button>
          <button onClick={acumular} disabled={acumulando || rows.length === 0 || hayPendientes} style={btnGreen}>
            {acumulando ? 'Acumulando...' : hayPendientes ? 'Guardando...' : 'Acumular todo'}
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, flexShrink: 0 }}>
        {[
          { label: 'REFERENCIAS',     value: rows.length,                               color: '#1d4ed8' },
          { label: 'CON CONTEO',      value: Object.values(edits).filter(e=>e.conteo!=='').length, color: '#16a34a' },
          { label: 'COSTO BODEGA',    value: fmt(totalBodega),                          color: '#1d4ed8' },
          { label: 'COSTO DIFERENCIA',value: fmt(totalDif),                             color: totalDif < 0 ? '#ef4444' : '#16a34a' },
          { label: 'PARTICIPACION',   value: totalBodega !== 0 ? ((totalDif/totalBodega)*100).toFixed(1)+'%' : '—', color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* TABLA — flex:1 + overflow:auto para scroll independiente */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            No hay datos. <a href="/cargar" style={{ color: '#2563eb' }}>Cargar inventario</a>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                {['Referencia','Descripcion','Loc','UM','Tipo','Cant. Sis.','Conteo','Diferencia','C. Unit.','C. Dif.','C. Bodega','Observaciones',''].map((h,i) => (
                  <th key={i} style={{
                    padding: '10px 10px', textAlign: i >= 5 && i <= 10 ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: '#374151', borderBottom: '2px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                    ...(h === 'Conteo' || h === 'Observaciones' ? { color: '#16a34a' } : {})
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const e = edits[r.id] ?? { conteo: '', obs: '', status: 'idle' as const }
                const conteo = e.conteo !== '' ? Number(e.conteo) : 0
                const dif    = conteo - Number(r.cantidad_sistema)
                const cDif   = dif * Number(r.costo_unitario)
                const bg     = idx % 2 === 0 ? '#fff' : '#f9fafb'
                return (
                  <tr key={r.id} style={{ background: bg }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }}>{r.referencia}</td>
                    <td style={{ padding: '7px 10px', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid #f0f0f0' }} title={r.descripcion}>{r.descripcion}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{r.localizacion}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0' }}>{r.um}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{r.tipo}</span>
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{Number(r.cantidad_sistema).toLocaleString('es-CO')}</td>

                    {/* CONTEO FISICO */}
                    <td style={{ padding: '3px 6px', background: '#f0fdf4', borderBottom: '1px solid #f0f0f0', minWidth: 90 }}>
                      <input type="number" value={e.conteo}
                        onChange={ev => handleChange(r.id, 'conteo', ev.target.value)}
                        placeholder="—"
                        style={{ ...inputStyle, textAlign: 'right', minWidth: 75 }}
                        onFocus={ev => { ev.target.style.background = '#dcfce7'; ev.target.style.borderRadius = '4px' }}
                        onBlur={ev  => { ev.target.style.background = 'transparent' }}
                      />
                    </td>

                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f0f0f0', color: dif < 0 ? '#ef4444' : dif > 0 ? '#16a34a' : 'inherit' }}>
                      {e.conteo !== '' ? dif.toLocaleString('es-CO') : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{fmt(r.costo_unitario)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', color: cDif < 0 ? '#ef4444' : 'inherit' }}>
                      {e.conteo !== '' ? fmt(cDif) : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{fmt(r.costo_bodega)}</td>

                    {/* OBSERVACIONES */}
                    <td style={{ padding: '3px 6px', background: '#f0fdf4', borderBottom: '1px solid #f0f0f0', minWidth: 160 }}>
                      <input type="text" value={e.obs}
                        onChange={ev => handleChange(r.id, 'obs', ev.target.value)}
                        placeholder="Observacion..."
                        style={{ ...inputStyle, minWidth: 150 }}
                        onFocus={ev => { ev.target.style.background = '#dcfce7'; ev.target.style.borderRadius = '4px' }}
                        onBlur={ev  => { ev.target.style.background = 'transparent' }}
                      />
                    </td>

                    <td style={{ padding: '7px 6px', textAlign: 'center', borderBottom: '1px solid #f0f0f0', width: 20 }}>
                      <StatusDot status={e.status} />
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