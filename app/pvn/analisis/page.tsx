'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

type Summary     = { total_registros: number; total_unidades: number; total_productos_distintos: number }
type Producto    = { producto_id: number; producto_nombre: string; total_vendido: number }
type Ingrediente = { componente_nombre: string; unidad: string; total_consumido: number }
type Tendencia   = { fecha: string; total_unidades: number }
type PuntoVenta  = { id: number; nombre: string; activo: boolean }

type Data = { summary: Summary; productos: Producto[]; ingredientes: Ingrediente[]; tendencia: Tendencia[] }

function limpiar(n: string) { return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '') }

function fmtNum(v: number, unidad: string) {
  if (unidad === 'KG')  return v.toFixed(3)
  if (unidad === 'GRM') return v.toFixed(1)
  return Math.round(v).toString()
}

function fmtFechaCort(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function AnalisisPVNPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData]       = useState<Data | null>(null)
  const [puntos, setPuntos]   = useState<PuntoVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [pvFiltro, setPvFiltro] = useState('todos')
  const [desde, setDesde]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])

  const { rol, area } = (session?.user ?? {}) as { rol?: string; area?: string }
  const canView = rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area ?? ''))

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  useEffect(() => {
    if (status === 'authenticated' && canView) {
      fetch('/api/pvn/puntos-venta').then(r => r.json()).then(setPuntos)
    }
  }, [status, canView])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      if (pvFiltro !== 'todos') params.set('punto_venta_id', pvFiltro)
      const res = await fetch(`/api/pvn/analisis?${params}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, pvFiltro])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargar()
  }, [status, canView, cargar])

  if (status === 'loading' || !canView) return null

  const totalVendido   = data?.productos?.reduce((s, p) => s + Number(p.total_vendido), 0) ?? 0
  const maxVendido     = Math.max(...(data?.productos?.map(p => Number(p.total_vendido)) ?? [1]), 1)
  const maxTendencia   = Math.max(...(data?.tendencia?.map(t => Number(t.total_unidades)) ?? [1]), 1)

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Análisis PVN</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Ventas y consumo de ingredientes por período</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {puntos.length > 0 && (
            <div>
              <label style={lbl}>Punto de Venta</label>
              <select value={pvFiltro} onChange={e => setPvFiltro(e.target.value)} style={inp}>
                <option value="todos">Todos los puntos</option>
                {puntos.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
              </select>
            </div>
          )}
          <div><label style={lbl}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inp} /></div>
          <button onClick={cargar} style={btnPrimary}>Filtrar</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Calculando...</div>}

      {!loading && data && (
        <>
          {/* Tarjetas */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Registros en el período', value: data.summary.total_registros,          color: '#0047BA' },
              { label: 'Unidades vendidas',        value: data.summary.total_unidades,           color: '#065f46' },
              { label: 'Productos distintos',      value: data.summary.total_productos_distintos, color: '#7c3aed' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

            {/* Ranking productos */}
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                Ventas por Producto
              </div>
              {data.productos.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
              )}
              {data.productos.map((p, i) => {
                const pct  = totalVendido > 0 ? Math.round((Number(p.total_vendido) / totalVendido) * 100) : 0
                const barW = Math.round((Number(p.total_vendido) / maxVendido) * 100)
                return (
                  <div key={p.producto_id} style={{ padding: '9px 20px', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: i < 3 ? 700 : 400 }}>
                        {i < 3 && <span style={{ marginRight: 5, fontSize: 11 }}>{['🥇','🥈','🥉'][i]}</span>}
                        {limpiar(p.producto_nombre)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0047BA', marginLeft: 8, whiteSpace: 'nowrap' }}>
                        {p.total_vendido} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: '#0047BA', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Tendencia diaria */}
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                Tendencia Diaria
              </div>
              {data.tendencia.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
              )}
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 370, overflowY: 'auto' }}>
                {data.tendencia.map(t => {
                  const barW = Math.round((Number(t.total_unidades) / maxTendencia) * 100)
                  return (
                    <div key={t.fecha} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#64748b', minWidth: 60, whiteSpace: 'nowrap' }}>{fmtFechaCort(t.fecha)}</span>
                      <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: '#6366f1', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', minWidth: 28, textAlign: 'right' }}>{t.total_unidades}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Consumo de ingredientes */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
              Consumo de Ingredientes
              <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>calculado según ventas registradas</span>
            </div>
            {data.ingredientes.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin datos</div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Ingrediente / Componente', 'Total Consumido', 'Unidad'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.ingredientes.map((ing, i) => (
                    <tr key={ing.componente_nombre} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 16px', color: '#1e293b', fontWeight: 500 }}>{ing.componente_nombre}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0047BA' }}>{fmtNum(Number(ing.total_consumido), ing.unidad)}</td>
                      <td style={{ padding: '10px 16px', color: '#64748b' }}>{ing.unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const lbl: React.CSSProperties        = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }
const inp: React.CSSProperties        = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
