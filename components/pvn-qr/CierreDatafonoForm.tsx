'use client'
import { useRef, useState } from 'react'
import { comprimirImagen } from './utils'
import { card, lbl, inp, btnSecondary, btnDanger } from './constants'

type Props = {
  cerrando: boolean
  error: string
  onCancelar: () => void
  onConfirmar: (foto: File, numeroRecogida: string) => void
}

export function CierreDatafonoForm({ cerrando, error, onCancelar, onConfirmar }: Props) {
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [numero, setNumero] = useState('')
  const [errorLocal, setErrorLocal] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function seleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorLocal('')
    const comprimida = await comprimirImagen(file)
    setFoto(comprimida)
    setPreview(URL.createObjectURL(comprimida))
  }

  function quitarFoto() {
    setFoto(null); setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function confirmar() {
    setErrorLocal('')
    if (!foto) { setErrorLocal('Adjunta la foto del cierre del datafono'); return }
    if (!/^\d+$/.test(numero.trim())) { setErrorLocal('Ingresa el número de recogida (solo dígitos)'); return }
    onConfirmar(foto, numero.trim())
  }

  return (
    <div onClick={onCancelar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#f1f5f9', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Cierre de turno</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Adjunta la foto del cierre del datafono y el número de recogida del cuadre de caja para poder cerrar.
        </div>

        {(error || errorLocal) && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#991b1b', fontSize: 13 }}>
            {error || errorLocal}
          </div>
        )}

        <div style={card}>
          <label style={lbl}>Foto del cierre del datafono</label>
          {preview ? (
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <img src={preview} alt="Cierre datafono" style={{ width: '100%', borderRadius: 8, maxHeight: 240, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
              <button
                onClick={quitarFoto}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #cbd5e1', borderRadius: 10, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>🧾</div>
              <div style={{ fontWeight: 600, color: '#475569', fontSize: 14 }}>Toca para tomar foto del cierre</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Desde cámara o galería</div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={seleccionarFoto} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} style={{ ...btnSecondary, width: '100%' }}>
            📷 {preview ? 'Cambiar foto' : 'Tomar foto'}
          </button>
        </div>

        <div style={card}>
          <label style={lbl}>Número de recogida</label>
          <input
            type="text"
            inputMode="numeric"
            value={numero}
            onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej: 123456"
            style={{ ...inp, fontSize: 20, fontWeight: 700 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancelar} disabled={cerrando} style={{ ...btnSecondary, flex: 1 }}>Cancelar</button>
          <button onClick={confirmar} disabled={cerrando} style={{ ...btnDanger, flex: 1, opacity: cerrando ? 0.6 : 1 }}>
            {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
          </button>
        </div>
      </div>
    </div>
  )
}
