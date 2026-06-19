'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { exportarExcel } from '@/lib/exportExcel'

type Pago = {
  id: number
  usuario_nombre: string
  punto_venta_id: number | null
  punto_venta_nombre: string | null
  fecha: string
  valor: number
  foto_url: string
  created_at: string
}
type PuntoVenta = { id: number; nombre: string; activo: boolean; tipo: string }

function fmtFechaHora(s: string) {
  return new Date(s).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtMoneda(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v))
}

export default function PagosQRPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [pagos, setPagos]     = useState<Pago[]>([])
  const [puntos, setPuntos]   = useState<PuntoVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [pvFiltro, setPvFiltro] = useState('todos')
  const [desde, setDesde]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])
  const [lightbox, setLightbox] = useState<string | null>(null)

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
      const res  = await fetch(`/api/qr/pagos?${params}`)
      const data = await res.json()
      setPagos(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, pvFiltro])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargar()
  }, [status, canView, cargar])

  function exportar() {
    const columnas = ['Fecha', 'Hora', 'Punto de Venta', 'Tipo', 'Usuario', 'Valor', 'Comprobante']
    const filas = pagos.map(p => {
      const pv = puntos.find(x => x.id === p.punto_venta_id)
      const fechaObj = new Date(p.created_at)
      return [
        p.fecha,
        fechaObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        p.punto_venta_nombre ?? '',
        pv?.tipo === 'principal' ? 'PVV' : pv?.tipo === 'nacional' ? 'PVN' : '',
        p.usuario_nombre,
        Number(p.valor),
        p.foto_url,
      ]
    })
    exportarExcel(`pagos_qr_${desde}_a_${hasta}`, columnas, filas, session?.user?.name ?? undefined, 'KLARENS  —  Consolidado de Pagos QR')
  }

  if (status === 'loading' || !canView) return null

  const totalValor = pagos.reduce((s, p) => s + Number(p.valor), 0)
  const puntosNacionales = puntos.filter(p => p.tipo === 'nacional')
  const puntosPrincipales = puntos.filter(p => p.tipo === 'principal')

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Pagos QR</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Comprobantes de pago QR subidos desde la app móvil</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {puntos.length > 0 && (
            <div>
              <label style={lbl}>Punto de Venta</label>
              <select value={pvFiltro} onChange={e => setPvFiltro(e.target.value)} style={inp}>
                <option value="todos">Todos</option>
                {puntosNacionales.length > 0 && (
                  <optgroup label="Nacionales (PVN)">
                    {puntosNacionales.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
                  </optgroup>
                )}
                {puntosPrincipales.length > 0 && (
                  <optgroup label="Principales (PVV)">
                    {puntosPrincipales.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          )}
          <div><label style={lbl}>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={inp} /></div>
          <button onClick={cargar} style={btnPrimary}>Filtrar</button>
          <button onClick={exportar} disabled={pagos.length === 0} style={{ ...btnSecondary, opacity: pagos.length === 0 ? 0.5 : 1, cursor: pagos.length === 0 ? 'not-allowed' : 'pointer' }}>
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {/* Resumen */}
      {!loading && pagos.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Pagos', value: pagos.length },
            { label: 'Total recaudado', value: fmtMoneda(totalValor) },
            { label: 'Puntos activos', value: new Set(pagos.map(p => p.punto_venta_id).filter(Boolean)).size || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0047BA' }}>{value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
        {!loading && pagos.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay pagos en el período</div>
        )}
        {!loading && pagos.map(p => (
          <div
            key={p.id}
            onClick={() => setLightbox(p.foto_url)}
            style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14,
              borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <img src={p.foto_url} alt="Comprobante" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0 }} />
            <div style={{ minWidth: 150, fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{fmtFechaHora(p.created_at)}</div>
            {p.punto_venta_nombre && (
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', whiteSpace: 'nowrap' }}>
                {p.punto_venta_nombre}
              </span>
            )}
            <div style={{ flex: 1, fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.usuario_nombre}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap' }}>
              {fmtMoneda(p.valor)}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
        >
          <img src={lightbox} alt="Comprobante ampliado" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties      = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }
const inp: React.CSSProperties      = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: '1px solid #0047BA', background: '#fff', color: '#0047BA', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
