'use client'
import { useRef, useState } from 'react'
import type { Turno } from '@/types/pvn-qr'
import { postPago } from '@/lib/api/pvn-qr'
import { comprimirImagen, fmtFecha } from './utils'
import { card, lbl, inp, btnPrimary } from './constants'

type Props = {
  turnoPendiente: Turno
  numero: number
  total: number
  onRegistrado: () => void
  onCancelarTanda: () => void
}

export function CargarQRPendienteForm({ turnoPendiente, numero, total, onRegistrado, onCancelarTanda }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

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
      const res = await postPago(foto, valorNum, turnoPendiente.id)
      if (!res.ok) { setError(res.error); return }
      setFoto(null); setPreview(null); setValor('')
      if (fileRef.current) fileRef.current.value = ''
      onRegistrado()
    } finally { setSubiendo(false) }
  }

  function cancelar() {
    if (confirm('¿Seguro que quieres cancelar? Los pagos que ya subiste quedan guardados, pero no vas a poder subir los que faltan de esta tanda.')) {
      onCancelarTanda()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px 16px' }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ background: '#fef3c7', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>Ventas QR pendientes del {fmtFecha(turnoPendiente.fecha)}</div>
          <div style={{ fontSize: 12, color: '#b45309', marginTop: 2, fontWeight: 600 }}>Pago {numero} de {total}</div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#991b1b', fontSize: 14 }}>{error}</div>
        )}

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
          <input ref={fileRef} type="file" accept="image/*" onChange={seleccionarFoto} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ ...btnPrimary, width: '100%' }}>
            📷 {preview ? 'Cambiar foto' : 'Tomar foto'}
          </button>
        </div>

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
          {subiendo ? 'Registrando...' : `Registrar pago ${numero} de ${total}`}
        </button>

        <button
          onClick={cancelar}
          style={{ width: '100%', padding: '12px 0', background: 'none', border: 'none', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancelar carga de pendientes
        </button>
      </div>
    </div>
  )
}
