'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'

type PagoHoy = {
  id: number
  punto_venta_nombre: string | null
  fecha: string
  valor: number
  foto_url: string
  created_at: string
}
type PuntoVenta = { id: number; nombre: string; activo: boolean }

function fmtMoneda(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtHora(s: string) {
  return new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export default function PagoQRWebPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [puntos, setPuntos]         = useState<PuntoVenta[]>([])
  const [puntoId, setPuntoId]       = useState<string>('')
  const [foto, setFoto]             = useState<File | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const [valor, setValor]           = useState('')
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [exito, setExito]           = useState('')

  const [pagosHoy, setPagosHoy]     = useState<PagoHoy[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(false)
  const [mostrarHoy, setMostrarHoy] = useState(false)
  const [cerrando, setCerrando]     = useState(false)
  const [cerrado, setCerrado]       = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const user     = session?.user as { rol?: string; punto_venta_id?: number | null; nombre?: string } | undefined
  const rol      = user?.rol ?? ''
  const esPvn    = rol === 'pvn'
  const esPvv    = rol === 'pvv'
  const permitido = esPvn || esPvv

  useEffect(() => {
    if (status === 'authenticated' && !permitido) router.replace('/dashboard')
  }, [status, permitido, router])

  useEffect(() => {
    if (status !== 'authenticated' || !esPvv) return
    fetch('/api/pvn/puntos-venta')
      .then(r => r.json())
      .then((data: PuntoVenta[]) => {
        const activos = data.filter(p => p.activo)
        setPuntos(activos)
        if (activos.length === 1) setPuntoId(String(activos[0].id))
      })
      .catch(() => {})
  }, [status, esPvv])

  const cargarPagosHoy = useCallback(async () => {
    setCargandoPagos(true)
    try {
      const res = await fetch('/api/qr/pagos')
      const data = await res.json()
      setPagosHoy(Array.isArray(data) ? data : [])
    } finally {
      setCargandoPagos(false)
    }
  }, [])

  function seleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    setPreview(URL.createObjectURL(file))
    setError('')
  }

  async function enviar() {
    setError('')
    if (!foto) { setError('Adjunta la foto del comprobante'); return }
    const valorNum = parseFloat(valor.replace(/[^\d.]/g, ''))
    if (!valorNum || valorNum <= 0) { setError('Ingresa un valor válido'); return }
    if (esPvv && !puntoId) { setError('Selecciona el punto de venta'); return }

    setGuardando(true)
    try {
      const form = new FormData()
      form.append('foto', foto)
      form.append('valor', String(valorNum))
      if (esPvv && puntoId) form.append('punto_venta_id', puntoId)

      const res = await fetch('/api/qr/pagos', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }

      setExito(`Pago de ${fmtMoneda(valorNum)} registrado correctamente`)
      setFoto(null)
      setPreview(null)
      setValor('')
      if (fileRef.current) fileRef.current.value = ''
      cargarPagosHoy()
    } finally {
      setGuardando(false)
    }
  }

  async function cerrarDia() {
    if (!confirm(`¿Confirmas el cierre del día con ${pagosHoy.length} pago(s) por ${fmtMoneda(totalHoy)}?`)) return
    setCerrando(true)
    try {
      await fetch('/api/qr/cierre-dia', { method: 'POST' })
      setCerrado(true)
    } finally {
      setCerrando(false)
    }
  }

  function abrirPagosHoy() {
    setMostrarHoy(true)
    setCerrado(false)
    cargarPagosHoy()
  }

  if (status === 'loading' || !permitido) return null

  const totalHoy = pagosHoy.reduce((s, p) => s + Number(p.valor), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

      {/* Encabezado punto de venta para PVN */}
      {esPvn && (
        <div style={{ background: '#eff6ff', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Punto de venta</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1d4ed8', marginTop: 2 }}>{(session?.user as { punto_venta_nombre?: string })?.punto_venta_nombre ?? 'Asignado'}</div>
          </div>
        </div>
      )}

      {/* Selector punto de venta para PVV */}
      {esPvv && puntos.length > 0 && (
        <div style={card}>
          <label style={lbl}>Punto de venta</label>
          <select value={puntoId} onChange={e => setPuntoId(e.target.value)} style={inp}>
            <option value="">— Selecciona —</option>
            {puntos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Botón mis pagos de hoy */}
      <button onClick={abrirPagosHoy} style={{ ...btnSecondary, width: '100%', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        📋 Mis pagos de hoy · Cerrar día
      </button>

      {/* Mensajes */}
      {exito && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#065f46', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
          <span>{exito}</span>
          <button onClick={() => setExito('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#991b1b', fontSize: 14 }}>{error}</div>
      )}

      {/* Foto del comprobante */}
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
            style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, color: '#94a3b8', fontSize: 14 }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div style={{ fontWeight: 600, color: '#475569' }}>Toca para tomar foto o adjuntar</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Desde galería o cámara</div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={seleccionarFoto}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fileRef.current?.click()} style={{ ...btnPrimary, flex: 1 }}>
            📷 {preview ? 'Cambiar foto' : 'Tomar foto'}
          </button>
          <button
            onClick={() => {
              if (fileRef.current) { fileRef.current.removeAttribute('capture'); fileRef.current.click(); setTimeout(() => fileRef.current?.setAttribute('capture', 'environment'), 500) }
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

      {/* Botón registrar */}
      <button
        onClick={enviar}
        disabled={guardando}
        style={{ ...btnPrimary, width: '100%', fontSize: 16, padding: '15px 0', opacity: guardando ? 0.7 : 1 }}
      >
        {guardando ? 'Registrando...' : 'Registrar pago'}
      </button>

      {/* Modal pagos de hoy */}
      {mostrarHoy && (
        <div
          onClick={() => setMostrarHoy(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#f1f5f9', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 20 }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 12px' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Mis pagos de hoy</span>
              <button onClick={() => setMostrarHoy(false)} style={{ background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Resumen */}
            <div style={{ display: 'flex', gap: 12, padding: '0 20px 16px' }}>
              {[{ label: 'Pagos', val: pagosHoy.length }, { label: 'Total', val: fmtMoneda(totalHoy) }].map(({ label, val }) => (
                <div key={label} style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0047BA' }}>{val}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {cargandoPagos && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Cargando...</div>}
              {!cargandoPagos && pagosHoy.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>Sin pagos registrados hoy</div>
              )}
              {!cargandoPagos && pagosHoy.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={p.foto_url} alt="Comprobante" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{fmtHora(p.created_at)}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{fmtMoneda(Number(p.valor))}</span>
                </div>
              ))}
            </div>

            {/* Cerrar día */}
            <div style={{ padding: '16px 20px 0' }}>
              {cerrado ? (
                <div style={{ background: '#d1fae5', borderRadius: 10, padding: 14, textAlign: 'center', color: '#065f46', fontWeight: 700 }}>
                  ✅ Día cerrado correctamente
                </div>
              ) : (
                <button
                  onClick={cerrarDia}
                  disabled={cerrando || pagosHoy.length === 0}
                  style={{ ...btnDanger, width: '100%', opacity: cerrando || pagosHoy.length === 0 ? 0.5 : 1, cursor: cerrando || pagosHoy.length === 0 ? 'not-allowed' : 'pointer' }}
                >
                  {cerrando ? 'Cerrando...' : 'Cerrar día'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card: React.CSSProperties    = { background: '#fff', borderRadius: 12, padding: '16px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const lbl: React.CSSProperties     = { display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }
const inp: React.CSSProperties     = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15, color: '#1e293b', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties  = { padding: '11px 20px', borderRadius: 10, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '11px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const btnDanger: React.CSSProperties   = { padding: '13px 20px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
