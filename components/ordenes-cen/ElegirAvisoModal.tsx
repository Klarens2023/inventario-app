'use client'
import { useEffect } from 'react'

export type ModoAviso = 'solo' | 'ruta'

// Al crear UN solo pedido en Siesa: avisa que solo se crea ese y pregunta si el correo a facturación va
// solo con él o con el consolidado de la ruta (todo lo que ya está en Siesa de esa ruta y aún no se ha
// avisado, incluidos los PVK institucionales).
export function ElegirAvisoModal({ oc, cliente, ruta, onElegir }: {
  oc: string
  cliente?: string | null
  ruta: string | null
  onElegir: (modo: ModoAviso | null) => void // null = cancelar, no se crea el pedido
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onElegir(null) }
    document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc)
  }, [onElegir])

  return (
    <div onClick={() => onElegir(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div onClick={e => e.stopPropagation()} className="card" role="dialog" aria-modal="true" aria-label="Enviar un solo pedido" style={{ width: '100%', maxWidth: 520 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Se enviará un solo pedido</h2>
        <p style={{ fontSize: 14, marginBottom: 6 }}>
          Solo se creará en Siesa el pedido de la <strong>OC {oc}</strong>{cliente ? <> · {cliente}</> : null}.
        </p>
        <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 14 }}>
          ¿Cómo quieres el correo de aviso a facturación?
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {ruta && (
            <button className="btn btn-primary" style={{ textAlign: 'left', padding: '10px 14px' }} onClick={() => onElegir('ruta')}>
              <strong>Junto al consolidado de la ruta {ruta}</strong>
              <div style={{ fontSize: 12, fontWeight: 400, opacity: .9 }}>Este pedido más todo lo de la ruta que ya está en Siesa y aún no se ha avisado (incluidos los PVK institucionales).</div>
            </button>
          )}
          <button className="btn" style={{ textAlign: 'left', padding: '10px 14px' }} onClick={() => onElegir('solo')}>
            <strong>Solo este pedido</strong>
            <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)' }}>El correo lleva únicamente este pedido.</div>
          </button>
          <button className="btn" onClick={() => onElegir(null)}>Cancelar (no crear el pedido)</button>
        </div>
      </div>
    </div>
  )
}
