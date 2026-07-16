'use client'
import type { PuntoVenta, ResumenCierre } from '@/types/pvn-qr'
import { fmtMoneda } from './utils'
import { lbl, inp, btnPrimary } from './constants'

type Props = {
  esRotatoria: boolean
  puntos: PuntoVenta[]
  puntoApertura: string
  onPuntoAperturaChange: (v: string) => void
  errorTurno: string
  abriendo: boolean
  onAbrir: () => void
  resumenCierre: ResumenCierre | null
}

export function AbrirTurnoScreen({ esRotatoria, puntos, puntoApertura, onPuntoAperturaChange, errorTurno, abriendo, onAbrir, resumenCierre }: Props) {
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
              <select value={puntoApertura} onChange={e => onPuntoAperturaChange(e.target.value)} style={inp}>
                <option value="">— Selecciona —</option>
                {puntos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
              </select>
            </div>
          )}
          <button onClick={onAbrir} disabled={abriendo} style={{ ...btnPrimary, width: '100%', fontSize: 16, padding: '14px 0', opacity: abriendo ? 0.7 : 1 }}>
            {abriendo ? 'Abriendo turno...' : '▶ Iniciar turno'}
          </button>
        </div>
      </div>
    </div>
  )
}
