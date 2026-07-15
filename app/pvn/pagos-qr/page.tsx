'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { exportarExcel } from '@/lib/exportExcel'

type Pago = {
  id: number
  usuario_id: number
  usuario_nombre: string
  punto_venta_id: number | null
  punto_venta_nombre: string | null
  fecha: string
  valor: number
  foto_url: string
  created_at: string
}
type PuntoVenta = { id: number; nombre: string; activo: boolean; tipo: string }
type Usuario = { id: number; nombre: string; rol: string }
type SortKey = 'fecha' | 'punto' | 'usuario' | 'valor'
type TurnoActivo = {
  id: number
  usuario_id: number
  usuario_nombre: string
  punto_venta_id: number
  punto_venta_nombre: string
  fecha: string
  abierto_at: string
}

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
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [pvFiltro, setPvFiltro] = useState('todos')
  const [usuarioFiltro, setUsuarioFiltro] = useState('todos')
  const [sortBy, setSortBy] = useState<SortKey>('fecha')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [desde, setDesde]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [editandoId, setEditandoId]     = useState<number | null>(null)
  const [valorEdit,  setValorEdit]      = useState('')
  const [puntoEdit,  setPuntoEdit]      = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [turnosActivos, setTurnosActivos] = useState<TurnoActivo[]>([])
  const [cargandoTurnos, setCargandoTurnos] = useState(false)
  const [cerrandoTurnoId, setCerrandoTurnoId] = useState<number | null>(null)
  const [mostrarTurnos, setMostrarTurnos] = useState(false)

  const { rol, area } = (session?.user ?? {}) as { rol?: string; area?: string }
  const canView = rol === 'admin' || (rol === 'lider' && ['logistica', 'general'].includes(area ?? ''))
  const isAdmin = rol === 'admin'

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  const cargarTurnosActivos = useCallback(async () => {
    setCargandoTurnos(true)
    try {
      const data = await fetch('/api/qr/turno/activos').then(r => r.json())
      setTurnosActivos(Array.isArray(data) ? data : [])
    } finally {
      setCargandoTurnos(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) cargarTurnosActivos()
  }, [status, isAdmin, cargarTurnosActivos])

  async function cerrarTurnoActivo(t: TurnoActivo) {
    if (!confirm(`¿Cerrar el turno de ${t.usuario_nombre} en ${t.punto_venta_nombre}?`)) return
    setCerrandoTurnoId(t.id)
    try {
      const res = await fetch('/api/qr/turno/activos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: t.id }),
      })
      if (res.ok) setTurnosActivos(prev => prev.filter(x => x.id !== t.id))
    } finally {
      setCerrandoTurnoId(null)
    }
  }

  function iniciarEdicionPago(p: Pago) {
    setEditandoId(p.id)
    setValorEdit(String(p.valor))
    setPuntoEdit(p.punto_venta_id ? String(p.punto_venta_id) : '')
  }

  async function guardarEdicionPago(id: number) {
    const valorNum = parseFloat(valorEdit.replace(/[^\d.]/g, ''))
    if (!valorNum || valorNum <= 0) return
    setGuardandoEdit(true)
    try {
      const res = await fetch(`/api/qr/pagos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: valorNum, punto_venta_id: puntoEdit || undefined }),
      })
      if (res.ok) { setEditandoId(null); cargar() }
    } finally {
      setGuardandoEdit(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && canView) {
      fetch('/api/pvn/puntos-venta').then(r => r.json()).then(setPuntos)
      fetch('/api/usuarios').then(r => r.json()).then((data: Usuario[]) => {
        setUsuarios(Array.isArray(data) ? data.filter(u => ['pvn', 'pvv'].includes(u.rol)) : [])
      })
    }
  }, [status, canView])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ desde, hasta })
      if (pvFiltro !== 'todos') params.set('punto_venta_id', pvFiltro)
      if (usuarioFiltro !== 'todos') params.set('usuario_id', usuarioFiltro)
      const res  = await fetch(`/api/qr/pagos?${params}`)
      const data = await res.json()
      setPagos(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [desde, hasta, pvFiltro, usuarioFiltro])

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  async function eliminarPago(p: Pago) {
    if (!confirm(`¿Eliminar el pago de ${p.usuario_nombre} por ${fmtMoneda(p.valor)}?`)) return
    setEliminandoId(p.id)
    try {
      const res = await fetch(`/api/qr/pagos/${p.id}`, { method: 'DELETE' })
      if (res.ok) setPagos(prev => prev.filter(x => x.id !== p.id))
    } finally {
      setEliminandoId(null)
    }
  }

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

  const pagosOrdenados = [...pagos].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'fecha') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    else if (sortBy === 'punto') cmp = (a.punto_venta_nombre ?? '').localeCompare(b.punto_venta_nombre ?? '')
    else if (sortBy === 'usuario') cmp = a.usuario_nombre.localeCompare(b.usuario_nombre)
    else if (sortBy === 'valor') cmp = Number(a.valor) - Number(b.valor)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function flecha(key: SortKey) {
    if (sortBy !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

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
          {usuarios.length > 0 && (
            <div>
              <label style={lbl}>Usuario</label>
              <select value={usuarioFiltro} onChange={e => setUsuarioFiltro(e.target.value)} style={inp}>
                <option value="todos">Todos</option>
                {usuarios.map(u => <option key={u.id} value={String(u.id)}>{u.nombre}</option>)}
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

      {/* Turnos activos (solo admin) */}
      {isAdmin && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 20, overflow: 'hidden' }}>
          <button
            onClick={() => setMostrarTurnos(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              🕐 Turnos activos ahora {turnosActivos.length > 0 && `(${turnosActivos.length})`}
            </span>
            <span style={{ color: '#94a3b8', transform: mostrarTurnos ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </button>
          {mostrarTurnos && (
            <div style={{ borderTop: '1px solid #f1f5f9' }}>
              {cargandoTurnos && <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
              {!cargandoTurnos && turnosActivos.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Nadie tiene un turno abierto ahora mismo</div>
              )}
              {!cargandoTurnos && turnosActivos.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ minWidth: 160, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.usuario_nombre}</div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', whiteSpace: 'nowrap' }}>
                    {t.punto_venta_nombre}
                  </span>
                  <div style={{ flex: 1, fontSize: 12, color: '#64748b' }}>
                    Desde {new Date(t.abierto_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <button
                    onClick={() => cerrarTurnoActivo(t)}
                    disabled={cerrandoTurnoId === t.id}
                    style={{ ...btnDanger, opacity: cerrandoTurnoId === t.id ? 0.6 : 1, cursor: cerrandoTurnoId === t.id ? 'not-allowed' : 'pointer' }}
                  >
                    {cerrandoTurnoId === t.id ? 'Cerrando...' : '⏹ Cerrar turno'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        {!loading && pagos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ width: 44, flexShrink: 0 }} />
            <button onClick={() => toggleSort('fecha')} style={{ ...colHeaderBtn, minWidth: 150 }}>Fecha{flecha('fecha')}</button>
            <button onClick={() => toggleSort('punto')} style={{ ...colHeaderBtn, width: 140 }}>Punto de venta{flecha('punto')}</button>
            <button onClick={() => toggleSort('usuario')} style={{ ...colHeaderBtn, flex: 1 }}>Usuario{flecha('usuario')}</button>
            <button onClick={() => toggleSort('valor')} style={{ ...colHeaderBtn, width: 100, justifyContent: 'flex-end' }}>Valor{flecha('valor')}</button>
            {isAdmin && <div style={{ width: 68, flexShrink: 0 }} />}
          </div>
        )}
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
        {!loading && pagos.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay pagos en el período</div>
        )}
        {!loading && pagosOrdenados.map(p => (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14,
              borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <img
              src={p.foto_url} alt="Comprobante" onClick={() => setLightbox(p.foto_url)}
              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0, cursor: 'pointer' }}
            />
            <div style={{ minWidth: 150, fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{fmtFechaHora(p.created_at)}</div>

            {editandoId === p.id ? (
              <select value={puntoEdit} onChange={e => setPuntoEdit(e.target.value)} style={{ ...inp, fontSize: 12, padding: '5px 8px' }}>
                <option value="">— Punto de venta —</option>
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
            ) : (
              p.punto_venta_nombre && (
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', whiteSpace: 'nowrap' }}>
                  {p.punto_venta_nombre}
                </span>
              )
            )}

            <div style={{ flex: 1, fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.usuario_nombre}
            </div>

            {editandoId === p.id ? (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  value={valorEdit}
                  onChange={e => setValorEdit(e.target.value)}
                  autoFocus
                  style={{ width: 100, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700, color: '#0f172a' }}
                />
                <button onClick={() => guardarEdicionPago(p.id)} disabled={guardandoEdit} title="Guardar" style={{ ...iconBtn, ...iconBtnConfirmar, opacity: guardandoEdit ? 0.6 : 1 }}>✓</button>
                <button onClick={() => setEditandoId(null)} title="Cancelar" style={{ ...iconBtn, ...iconBtnCancelar }}>×</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap' }}>
                  {fmtMoneda(p.valor)}
                </div>
                {isAdmin && (
                  <>
                    <button onClick={() => iniciarEdicionPago(p)} title="Editar valor / punto de venta" style={iconBtn}>✏️</button>
                    <button onClick={() => eliminarPago(p)} disabled={eliminandoId === p.id} title="Eliminar pago" style={{ ...iconBtn, opacity: eliminandoId === p.id ? 0.5 : 1 }}>🗑️</button>
                  </>
                )}
              </>
            )}
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
const btnDanger: React.CSSProperties    = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }
const iconBtn: React.CSSProperties      = { background: '#f1f5f9', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, flexShrink: 0 }
const iconBtnConfirmar: React.CSSProperties = { background: '#dcfce7', color: '#16a34a', fontWeight: 800 }
const iconBtnCancelar: React.CSSProperties  = { background: '#fee2e2', color: '#dc2626', fontWeight: 800 }
const colHeaderBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
}
