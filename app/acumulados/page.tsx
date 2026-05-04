'use client'
import { useState, useMemo } from 'react'

type Row = {
  fecha: string; categoria: string; tipo: string; referencia: string
  descripcion: string; localizacion: string; um: string
  cantidad_sistema: number; costo_unitario: number
  conteo_fisico: number; diferencia: number
  costo_diferencia: number; costo_bodega_total: number; observaciones: string
}

type Totales = { costo_bodega: number; costo_diferencia: number }

function fmt(n: number, prefix = '$') {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const s = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
  return (n < 0 ? `-${prefix}` : prefix) + s
}

// Formato de fecha similar al video (YYYY/MM/DD)
function fmtFechaCorta(f: string) {
  return String(f).substring(0, 10).replace(/-/g, '/')
}

export default function AcumuladosPage() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [totales, setTotales] = useState<Totales | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reiniciando, setRein] = useState(false)
  const [confirm, setConfirm] = useState(0)
  
  // Estado para controlar la vista de detalle (Drill-down)
  const [detalleSeleccionado, setDetalleSeleccionado] = useState<Row | null>(null)

  async function buscar() {
    setLoading(true)
    setError('')
    setDetalleSeleccionado(null)
    try {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)

      const res = await fetch(`/api/acumulados?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        setRows([])
        setTotales(null)
      } else {
        setRows(data.rows ?? [])
        setTotales(data.totales ?? null)
      }
    } catch (e: any) {
      setError('Error de conexion: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function reiniciar() {
    if (confirm < 1) { setConfirm(1); return }
    setRein(true)
    try {
      await fetch('/api/reiniciar', { method: 'DELETE' })
      setRows([]); setTotales(null); setConfirm(0); setDetalleSeleccionado(null)
      alert('Historial eliminado correctamente.')
    } catch { alert('Error al reiniciar.') }
    setRein(false)
  }

  // Generamos la estructura de Matriz/Pivot Table
  const pivotData = useMemo(() => {
    const fechasSet = new Set<string>()
    const mapItems: Record<string, { referencia: string, descripcion: string, datosPorFecha: Record<string, Row> }> = {}

    rows.forEach(r => {
      const fechaCorta = fmtFechaCorta(r.fecha)
      fechasSet.add(fechaCorta)
      
      if (!mapItems[r.referencia]) {
        mapItems[r.referencia] = { referencia: r.referencia, descripcion: r.descripcion, datosPorFecha: {} }
      }
      // Almacenamos el registro completo bajo la fecha correspondiente
      mapItems[r.referencia].datosPorFecha[fechaCorta] = r
    })

    return {
      fechas: Array.from(fechasSet).sort((a, b) => a.localeCompare(b)),
      items: Object.values(mapItems).sort((a, b) => a.referencia.localeCompare(b.referencia))
    }
  }, [rows])

  const participacion = totales && totales.costo_bodega !== 0
    ? ((totales.costo_diferencia / totales.costo_bodega) * 100).toFixed(1) + '%'
    : '—'

  return (
    <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Informe Acumulados</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
            Suma de diferencias en matriz por referencia y fecha
          </p>
        </div>
        <button onClick={reiniciar} disabled={reiniciando} className="btn btn-danger" style={{ fontSize: 12 }}>
          {confirm === 1 ? 'CONFIRMAR BORRADO TOTAL' : 'Reiniciar historial'}
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <button onClick={buscar} className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-end' }}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 6, background: 'rgba(248,81,73,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Totales globales */}
      {totales && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="stat-card"><div className="stat-label">Registros</div><div className="stat-value">{rows.length}</div></div>
          <div className="stat-card"><div className="stat-label">Costo Bodega Total</div><div className="stat-value" style={{ fontSize: 15 }}>{fmt(totales.costo_bodega)}</div></div>
          <div className="stat-card">
            <div className="stat-label">Costo Diferencia Total</div>
            <div className="stat-value" style={{ fontSize: 15, color: totales.costo_diferencia < 0 ? 'var(--danger)' : 'var(--accent)' }}>
              {fmt(totales.costo_diferencia)}
            </div>
          </div>
          <div className="stat-card"><div className="stat-label">Participacion</div><div className="stat-value" style={{ color: 'var(--warn)' }}>{participacion}</div></div>
        </div>
      )}

      {/* MATRIZ DE DATOS (Estilo Excel) */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando matriz...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Sin datos. Selecciona un rango y presiona Buscar.</div>
        ) : (
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'right' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg3)' }}>
              <tr>
                <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 100 }}>REFERENCIA</th>
                <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', minWidth: 250 }}>DESCRIPCION</th>
                {pivotData.fechas.map(f => (
                  <th key={f} style={{ border: '1px solid var(--border)', padding: '6px 10px', minWidth: 80, textAlign: 'center' }}>
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivotData.items.map((item, idx) => (
                <tr key={item.referencia} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                  <td style={{ border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'left', fontWeight: 'bold' }}>{item.referencia}</td>
                  <td style={{ border: '1px solid var(--border)', padding: '4px 10px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                    {item.descripcion}
                  </td>
                  {pivotData.fechas.map(f => {
                    const rowData = item.datosPorFecha[f];
                    const dif = rowData ? Number(rowData.diferencia) : null;
                    return (
                      <td 
                        key={f} 
                        onClick={() => rowData && setDetalleSeleccionado(rowData)}
                        style={{ 
                          border: '1px solid var(--border)', 
                          padding: '4px 10px',
                          cursor: rowData ? 'pointer' : 'default',
                          color: dif && dif < 0 ? 'var(--danger)' : dif && dif > 0 ? 'var(--accent)' : 'inherit',
                          backgroundColor: rowData ? 'rgba(0,0,0,0.02)' : 'transparent'
                        }}
                        title={rowData ? "Clic para ver detalles" : ""}
                      >
                        {dif !== null && dif !== 0 ? dif.toLocaleString('es-CO') : (dif === 0 ? '0' : '')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* VISTA DE DETALLE (Drill-Down Modal) */}
      {detalleSeleccionado && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{ background: 'var(--bg)', width: '95%', maxWidth: 1200, borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)' }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>
                Detalles de Suma de DIFERENCIAS - {detalleSeleccionado.descripcion} | {fmtFechaCorta(detalleSeleccionado.fecha)}
              </h2>
              <button onClick={() => setDetalleSeleccionado(null)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text)' }}>
                ✕
              </button>
            </div>
            <div style={{ padding: 20, overflowX: 'auto' }}>
              <table className="inv-table" style={{ minWidth: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#4A86E8', color: 'white' }}>
                    <th>REFERENCIA</th>
                    <th>DESCRIPCION</th>
                    <th>LOCALIZACION</th>
                    <th>U.M</th>
                    <th>FECHA</th>
                    <th>CONTEO FISICO</th>
                    <th>CANTIDAD SISTEMA</th>
                    <th>DIFERENCIA</th>
                    <th>COSTO UNITARIO</th>
                    <th>COSTO DIFERENCIA</th>
                    <th>COSTO BODEGA</th>
                    <th>OBSERVACIONES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{detalleSeleccionado.referencia}</td>
                    <td>{detalleSeleccionado.descripcion}</td>
                    <td>{detalleSeleccionado.localizacion}</td>
                    <td>{detalleSeleccionado.um}</td>
                    <td>{fmtFechaCorta(detalleSeleccionado.fecha)}</td>
                    <td style={{ textAlign: 'right' }}>{Number(detalleSeleccionado.conteo_fisico).toLocaleString('es-CO')}</td>
                    <td style={{ textAlign: 'right' }}>{Number(detalleSeleccionado.cantidad_sistema).toLocaleString('es-CO')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{Number(detalleSeleccionado.diferencia).toLocaleString('es-CO')}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(detalleSeleccionado.costo_unitario)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(detalleSeleccionado.costo_diferencia)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(detalleSeleccionado.costo_bodega_total)}</td>
                    <td>{detalleSeleccionado.observaciones || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}