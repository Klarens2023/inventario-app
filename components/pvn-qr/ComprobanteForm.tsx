'use client'
import { RefObject } from 'react'
import { fmtHora } from './utils'
import { card, lbl, inp, btnPrimary, btnSecondary } from './constants'

type Props = {
  necesitaTurno: boolean
  nombrePunto?: string
  turnoAbiertoAt?: string
  onVerPagos: () => void
  exito: string
  onCerrarExito: () => void
  error: string
  preview: string | null
  onQuitarFoto: () => void
  fileRef: RefObject<HTMLInputElement>
  onSeleccionarFoto: (e: React.ChangeEvent<HTMLInputElement>) => void
  valor: string
  onValorChange: (v: string) => void
  onEnviar: () => void
  subiendo: boolean
}

export function ComprobanteForm({
  necesitaTurno, nombrePunto, turnoAbiertoAt, onVerPagos,
  exito, onCerrarExito, error,
  preview, onQuitarFoto, fileRef, onSeleccionarFoto,
  valor, onValorChange, onEnviar, subiendo,
}: Props) {
  return (
    <>
      {necesitaTurno && nombrePunto && turnoAbiertoAt && (
        <div style={{ background: '#0047BA', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Turno activo · {nombrePunto}</div>
            <div style={{ fontSize: 12, color: '#bfdbfe', marginTop: 2 }}>Desde {fmtHora(turnoAbiertoAt)}</div>
          </div>
          <button
            onClick={onVerPagos}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            📋 Ver pagos
          </button>
        </div>
      )}

      {exito && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#065f46', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{exito}</span>
          <button onClick={onCerrarExito} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
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
              onClick={onQuitarFoto}
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
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onSeleccionarFoto} style={{ display: 'none' }} />
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
          onChange={e => onValorChange(e.target.value)}
          placeholder="Ej: 25000"
          style={{ ...inp, fontSize: 22, fontWeight: 700 }}
        />
      </div>

      <button
        onClick={onEnviar}
        disabled={subiendo}
        style={{ ...btnPrimary, width: '100%', fontSize: 16, padding: '15px 0', marginBottom: 12, opacity: subiendo ? 0.7 : 1 }}
      >
        {subiendo ? 'Registrando...' : 'Registrar pago'}
      </button>
    </>
  )
}
