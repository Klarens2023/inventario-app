'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

type Detalle  = { producto_id: number; producto_nombre: string; cantidad: number }
type Registro = {
  id: number
  fecha: string
  turno: string
  usuario_nombre: string
  observaciones: string | null
  total_unidades: number
  total_productos: number
  detalle: Detalle[]
}

const TURNO_STYLE: Record<string, { color: string; bg: string }> = {
  'Mañana': { color: '#92400e', bg: '#fef3c7' },
  'Tarde':  { color: '#1e3a5f', bg: '#dbeafe' },
  'Noche':  { color: '#4c1d95', bg: '#ede9fe' },
  'Cierre': { color: '#065f46', bg: '#d1fae5' },
}

function fmtFecha(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function limpiar(n: string) { return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '') }

export default function HistorialPVNPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading]     = useState(false)
  const [expanded, setExpanded]   = useState<number | null>(null)
  const [desde, setDesde]         = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])

  const { rol, area } = (session?.user ?? {}) as { rol?: string; area?: string }
  const canView = rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area ?? ''))

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pvn/registros?desde=${desde}&hasta=${hasta}`)
      const data = await res.json()
      setRegistros(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargar()
  }, [status, canView, cargar])

  if (status === 'loading' || !canView) return null

  const totalPeriodo = registros.reduce((s, r) => s + r.total_unidades, 0)

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Historial PVN</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Registro de ventas del punto de venta</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inp} />
          </div>
          <button onClick={cargar} style={btnPrimary}>Filtrar</button>
        </div>
      </div>

      {/* Resumen rápido */}
      {!loading && registros.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Registros', value: registros.length },
            { label: 'Total unidades', value: totalPeriodo },
            { label: 'Turnos Mañana', value: registros.filter(r => r.turno === 'Mañana').length },
            { label: 'Turnos Cierre', value: registros.filter(r => r.turno === 'Cierre').length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0047BA' }}>{value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
        {!loading && registros.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay registros en el período</div>
        )}
        {!loading && registros.map(r => {
          const ts = TURNO_STYLE[r.turno] ?? { color: '#374151', bg: '#f3f4f6' }
          const open = expanded === r.id
          return (
            <div key={r.id}>
              <div
                onClick={() => setExpanded(open ? null : r.id)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '13px 20px', gap: 12,
                  borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                  background: open ? '#f8fafc' : '#fff', transition: 'background 0.15s'
                }}
              >
                <div style={{ minWidth: 100, fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{fmtFecha(r.fecha)}</div>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: ts.color, background: ts.bg, whiteSpace: 'nowrap' }}>
                  {r.turno}
                </span>
                <div style={{ flex: 1, fontSize: 13, color: '#475569' }}>{r.usuario_nombre}</div>
                <div style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: '#0f172a' }}>{r.total_unidades}</strong> uds
                  {' · '}
                  <strong style={{ color: '#0f172a' }}>{r.total_productos}</strong> prod
                </div>
                <span style={{ fontSize: 16, color: '#94a3b8', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
              </div>

              {open && (
                <div style={{ background: '#f8fafc', padding: '12px 20px 16px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: r.observaciones ? 10 : 0 }}>
                    {r.detalle.map(d => (
                      <div key={d.producto_id} style={{ background: '#fff', borderRadius: 8, padding: '7px 14px', border: '1px solid #e2e8f0', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#475569' }}>{limpiar(d.producto_nombre)}</span>
                        <span style={{ fontWeight: 800, color: '#0047BA', fontSize: 15 }}>{d.cantidad}</span>
                      </div>
                    ))}
                  </div>
                  {r.observaciones && (
                    <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>Obs: {r.observaciones}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
