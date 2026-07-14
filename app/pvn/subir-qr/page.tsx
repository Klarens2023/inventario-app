'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'

type Turno = { id: number; punto_venta_id: number; punto_venta_nombre: string; fecha: string; abierto_at: string }
type TurnoResp = { turnoHoy: Turno | null; turnoPendiente: Turno | null }
type PuntoVenta = { id: number; nombre: string; activo: boolean; tipo: string }
type Pago = { id: number; punto_venta_nombre: string | null; fecha: string; valor: number; foto_url: string; created_at: string }

function fmtMoneda(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtHora(s: string) {
  return new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function fmtFecha(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

async function comprimirImagen(file: File, maxDim = 1600, calidad = 0.8): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > maxDim || height > maxDim) {
      const escala = maxDim / Math.max(width, height)
      width = Math.round(width * escala)
      height = Math.round(height * escala)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', calidad))
    if (!blob) return file
    return new File([blob], (file.name?.replace(/\.\w+$/, '') || 'comprobante') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

export default function SubirQRPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const rol         = session?.user?.rol ?? ''
  const pvFijo      = (session?.user as { punto_venta_id?: number })?.punto_venta_id ?? null
  const esPvn       = rol === 'pvn'
  const esPvv       = rol === 'pvv'
  const permitido   = esPvn || esPvv
  const esRotatoria = esPvv && !pvFijo      // pvv sin punto asignado: además de tener turno, elige/cambia de punto
  const necesitaTurno = permitido           // todos (pvn, pvv fija y pvv rotativa) controlan apertura/cierre de turno

  useEffect(() => {
    if (status === 'authenticated' && !permitido) router.replace('/dashboard')
  }, [status, permitido, router])

  // Turno
  const [turnoHoy,       setTurnoHoy]       = useState<Turno | null | undefined>(undefined)
  const [turnoPendiente, setTurnoPendiente] = useState<Turno | null>(null)
  const [puntos,         setPuntos]         = useState<PuntoVenta[]>([])
  const [puntoApertura,  setPuntoApertura]  = useState('')
  const [abriendo,       setAbriendo]       = useState(false)
  const [cerrando,       setCerrando]       = useState(false)
  const [errorTurno,     setErrorTurno]     = useState('')
  const [resumenCierre,  setResumenCierre]  = useState<{ total_pagos: number; total_valor: number } | null>(null)

  // Formulario de pago
  const [foto,      setFoto]      = useState<File | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [valor,     setValor]     = useState('')
  const [subiendo,  setSubiendo]  = useState(false)
  const [error,     setError]     = useState('')
  const [exito,     setExito]     = useState('')
  const [pagosHoy,  setPagosHoy]  = useState<Pago[]>([])
  const [mostrarHoy, setMostrarHoy] = useState(false)
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [lightbox,  setLightbox]  = useState<string | null>(null)
  const [editandoId, setEditandoId]     = useState<number | null>(null)
  const [valorEdit,  setValorEdit]      = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !permitido) return
    fetch('/api/qr/turno?pendiente=true')
      .then(r => r.json())
      .then((d: TurnoResp) => { setTurnoHoy(d.turnoHoy); setTurnoPendiente(d.turnoPendiente) })
      .catch(() => { setTurnoHoy(null); setTurnoPendiente(null) })
    if (esRotatoria) {
      fetch('/api/pvn/puntos-venta')
        .then(r => r.json())
        .then((data: PuntoVenta[]) => setPuntos(data.filter(p => p.activo && p.tipo === 'principal')))
        .catch(() => {})
    }
    cargarPagosHoy()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, permitido, esRotatoria])

  const cargarPagosHoy = useCallback(async () => {
    setCargandoPagos(true)
    try {
      const data = await fetch('/api/qr/pagos').then(r => r.json())
      setPagosHoy(Array.isArray(data) ? data : [])
    } finally { setCargandoPagos(false) }
  }, [])

  async function abrirTurno() {
    setErrorTurno('')
    if (esRotatoria && !puntoApertura) { setErrorTurno('Selecciona el punto de venta'); return }
    setAbriendo(true)
    try {
      const res = await fetch('/api/qr/turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'abrir', punto_venta_id: puntoApertura }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorTurno(data.error ?? 'Error al abrir turno'); return }
      setTurnoHoy(data)
      setResumenCierre(null)
      setPuntoApertura('')
    } finally { setAbriendo(false) }
  }

  async function cerrarTurno(turnoId?: number) {
    if (!confirm('¿Confirmas el cierre del turno?')) return
    setCerrando(true)
    try {
      const body: Record<string, unknown> = { accion: 'cerrar' }
      if (turnoId) body.turno_id = turnoId
      const res = await fetch('/api/qr/turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setResumenCierre({ total_pagos: data.total_pagos, total_valor: data.total_valor })
        setTurnoHoy(null)
        setTurnoPendiente(null)
        setMostrarHoy(false)
      }
    } finally { setCerrando(false) }
  }

  async function seleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const comprimida = await comprimirImagen(file)
    setFoto(comprimida)
    setPreview(URL.createObjectURL(comprimida))
  }

  async function enviar() {
    setError('')
    if (!foto) { setError('Adjunta la foto del comprobante'); return }
    const valorNum = parseFloat(valor.replace(/[^\d.]/g, ''))
    if (!valorNum || valorNum <= 0) { setError('Ingresa un valor válido'); return }
    setSubiendo(true)
    try {
      const form = new FormData()
      form.append('foto', foto)
      form.append('valor', String(valorNum))
      const res = await fetch('/api/qr/pagos', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrar'); return }
      setExito(`Pago de ${fmtMoneda(valorNum)} registrado`)
      setFoto(null); setPreview(null); setValor('')
      if (fileRef.current) fileRef.current.value = ''
      cargarPagosHoy()
    } finally { setSubiendo(false) }
  }

  const totalHoy = pagosHoy.reduce((s, p) => s + Number(p.valor), 0)

  function iniciarEdicion(p: Pago) {
    setEditandoId(p.id)
    setValorEdit(String(p.valor))
  }

  async function guardarEdicion(id: number) {
    const valorNum = parseFloat(valorEdit.replace(/[^\d.]/g, ''))
    if (!valorNum || valorNum <= 0) return
    setGuardandoEdit(true)
    try {
      const res = await fetch(`/api/qr/pagos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: valorNum }),
      })
      if (res.ok) { setEditandoId(null); cargarPagosHoy() }
    } finally { setGuardandoEdit(false) }
  }

  async function eliminarPago(id: number) {
    if (!confirm('¿Eliminar este pago?')) return
    setEliminandoId(id)
    try {
      const res = await fetch(`/api/qr/pagos/${id}`, { method: 'DELETE' })
      if (res.ok) cargarPagosHoy()
    } finally { setEliminandoId(null) }
  }

  function cerrarPanelHoy() {
    setMostrarHoy(false)
    setErrorTurno('')
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading' || !permitido || (necesitaTurno && turnoHoy === undefined)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</div>
      </div>
    )
  }

  // ── Turno pendiente de día anterior ──────────────────────────────────────
  if (necesitaTurno && turnoPendiente && !turnoHoy) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Turno pendiente</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 6 }}>
              Tienes un turno sin cerrar del
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
              {fmtFecha(turnoPendiente.fecha)}
            </p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
              Punto: <strong>{turnoPendiente.punto_venta_nombre}</strong>
            </p>
            <button
              onClick={() => cerrarTurno(turnoPendiente.id)}
              disabled={cerrando}
              style={{ ...btnDanger, width: '100%', padding: '13px 0', fontSize: 15, opacity: cerrando ? 0.7 : 1 }}
            >
              {cerrando ? 'Cerrando...' : '⏹ Cerrar turno pendiente'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Sin turno abierto ──────────────────────────────────────────────────────
  if (necesitaTurno && !turnoHoy) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {resumenCierre && (
            <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>✅</div>
              <div style={{ fontWeight: 700, color: '#065f46', marginTop: 6 }}>Turno cerrado</div>
              <div style={{ fontSize: 13, color: '#047857', marginTop: 4 }}>
                {resumenCierre.total_pagos} pago(s) · {fmtMoneda(resumenCierre.total_valor)}
              </div>
            </div>
          )}
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Abrir turno</h2>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                {esRotatoria ? 'Selecciona el punto donde vas a trabajar hoy' : 'Confirma el inicio de tu turno para comenzar a registrar pagos'}
              </p>
            </div>
            {errorTurno && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{errorTurno}</div>
            )}
            {esRotatoria && (
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Punto de venta</label>
                <select value={puntoApertura} onChange={e => setPuntoApertura(e.target.value)} style={inp}>
                  <option value="">— Selecciona —</option>
                  {puntos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
                </select>
              </div>
            )}
            <button onClick={() => abrirTurno()} disabled={abriendo} style={{ ...btnPrimary, width: '100%', fontSize: 16, padding: '14px 0', opacity: abriendo ? 0.7 : 1 }}>
              {abriendo ? 'Abriendo turno...' : '▶ Iniciar turno'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Pantalla principal: subir comprobante ─────────────────────────────────
  const nombrePunto = necesitaTurno ? turnoHoy?.punto_venta_nombre : undefined

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '64px 16px 16px', maxWidth: 480, margin: '0 auto' }}>

      {/* Banner turno / punto */}
      {necesitaTurno && turnoHoy && (
        <div style={{ background: '#0047BA', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Turno activo · {nombrePunto}</div>
            <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 2 }}>Desde {fmtHora(turnoHoy.abierto_at)}</div>
          </div>
          <button
            onClick={() => { setMostrarHoy(true); cargarPagosHoy() }}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            📋 Ver pagos
          </button>
        </div>
      )}

      {exito && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#065f46', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{exito}</span>
          <button onClick={() => setExito('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#991b1b', fontSize: 14 }}>{error}</div>
      )}

      {/* Foto */}
      <div style={card}>
        <label style={lbl}>Comprobante</label>
        {preview ? (
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <img src={preview} alt="Comprobante" style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
            <button
              onClick={() => { setFoto(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
              style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div style={{ fontWeight: 600, color: '#475569', fontSize: 14 }}>Toca para tomar foto o adjuntar</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Desde galería o cámara</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={seleccionarFoto} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fileRef.current?.click()} style={{ ...btnPrimary, flex: 1 }}>
            📷 {preview ? 'Cambiar foto' : 'Tomar foto'}
          </button>
          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.removeAttribute('capture')
                fileRef.current.click()
                setTimeout(() => fileRef.current?.setAttribute('capture', 'environment'), 500)
              }
            }}
            style={{ ...btnSecondary, flex: 1 }}
          >
            🖼 Galería
          </button>
        </div>
      </div>

      {/* Valor */}
      <div style={card}>
        <label style={lbl}>Valor de la transacción</label>
        <input
          type="number"
          inputMode="numeric"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Ej: 25000"
          style={{ ...inp, fontSize: 22, fontWeight: 700 }}
        />
      </div>

      <button
        onClick={enviar}
        disabled={subiendo}
        style={{ ...btnPrimary, width: '100%', fontSize: 16, padding: '15px 0', marginBottom: 12, opacity: subiendo ? 0.7 : 1 }}
      >
        {subiendo ? 'Registrando...' : 'Registrar pago'}
      </button>

      {/* Panel mis pagos hoy */}
      {mostrarHoy && (
        <div onClick={cerrarPanelHoy} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#f1f5f9', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 12px' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Mis pagos de hoy</div>
                {nombrePunto && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{nombrePunto}</div>}
              </div>
              <button onClick={cerrarPanelHoy} style={{ background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#475569' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '0 20px 16px' }}>
              {[{ label: 'Pagos', val: String(pagosHoy.length) }, { label: 'Total', val: fmtMoneda(totalHoy) }].map(({ label, val }) => (
                <div key={label} style={{ flex: 1, background: '#fff', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0047BA' }}>{val}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {cargandoPagos && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Cargando...</div>}
              {!cargandoPagos && pagosHoy.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>Sin pagos hoy</div>}
              {!cargandoPagos && pagosHoy.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={p.foto_url} alt="" onClick={() => setLightbox(p.foto_url)}
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{fmtHora(p.created_at)}</span>
                  <span style={{ flex: 1 }} />
                  {editandoId === p.id ? (
                    <>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={valorEdit}
                        onChange={e => setValorEdit(e.target.value)}
                        autoFocus
                        style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700, color: '#0f172a' }}
                      />
                      <button onClick={() => guardarEdicion(p.id)} disabled={guardandoEdit} title="Guardar" style={iconBtn}>✓</button>
                      <button onClick={() => setEditandoId(null)} title="Cancelar" style={iconBtn}>×</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{fmtMoneda(Number(p.valor))}</span>
                      <button onClick={() => iniciarEdicion(p)} title="Editar valor" style={iconBtn}>✏️</button>
                      <button onClick={() => eliminarPago(p.id)} disabled={eliminandoId === p.id} title="Eliminar" style={{ ...iconBtn, opacity: eliminandoId === p.id ? 0.5 : 1 }}>🗑️</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {necesitaTurno && (
              <div style={{ padding: '16px 20px 0' }}>
                <button
                  onClick={() => cerrarTurno()}
                  disabled={cerrando}
                  style={{ ...btnDanger, width: '100%', opacity: cerrando ? 0.6 : 1, cursor: cerrando ? 'not-allowed' : 'pointer' }}
                >
                  {cerrando ? 'Cerrando...' : `⏹ Cerrar turno${pagosHoy.length > 0 ? ` · ${fmtMoneda(totalHoy)}` : ''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties         = { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties          = { display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }
const inp: React.CSSProperties          = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15, color: '#1e293b', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties   = { padding: '11px 20px', borderRadius: 10, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '11px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const btnDanger: React.CSSProperties    = { padding: '13px 20px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
const iconBtn: React.CSSProperties      = { background: '#f1f5f9', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, flexShrink: 0 }
