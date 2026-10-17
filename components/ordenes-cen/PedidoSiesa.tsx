'use client'
import { useState } from 'react'
import type { OrdenCen } from '@/types/ordenes-cen'

type Aviso = { nivel: 'bloqueo' | 'alerta' | 'info'; mensaje: string }
type Prep = {
  documento: unknown
  avisos: Aviso[]
  puedeEnviar: boolean
  resumen: { cliente: string; listaPrecio: string; condPago: string; bodega: string; tipoDocto: string; fechaEntrega: string; diasEntrega: number }
}

const COLOR: Record<Aviso['nivel'], { bg: string; fg: string; icono: string }> = {
  bloqueo: { bg: '#FEE2E2', fg: '#991B1B', icono: '⛔' },
  alerta: { bg: '#FEF3C7', fg: '#92400E', icono: '⚠' },
  info: { bg: '#E0ECFF', fg: '#1E3A8A', icono: 'ℹ' },
}

// Sección del detalle de la orden: valida y crea el pedido de venta en Siesa.
export function PedidoSiesa({ orden, onEnviado }: { orden: OrdenCen & { siesa_consecutivo?: string | null; siesa_respuesta?: unknown; enviado_at?: string | null }; onEnviado: () => void }) {
  const [prep, setPrep] = useState<Prep | null>(null)
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [confirma, setConfirma] = useState(false)
  const [verJson, setVerJson] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string; detalle?: unknown } | null>(null)

  async function preparar() {
    setCargando(true); setMensaje(null); setPrep(null); setConfirma(false)
    try {
      const res = await fetch(`/api/logistica/ordenes-cen/${orden.id}/pedido`)
      const data = await res.json()
      if (!res.ok) setMensaje({ ok: false, texto: data.error ?? 'No se pudo preparar el pedido' })
      else setPrep(data)
    } finally { setCargando(false) }
  }

  async function enviar() {
    setEnviando(true); setMensaje(null)
    try {
      const res = await fetch(`/api/logistica/ordenes-cen/${orden.id}/pedido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmaAlertas: confirma }),
      })
      const data = await res.json()
      setMensaje({ ok: Boolean(data.ok), texto: data.mensaje ?? data.error ?? 'Respuesta desconocida', detalle: data.ok ? undefined : data.respuesta })
      if (data.prep) setPrep(data.prep)
      if (data.ok) onEnviado()
    } finally { setEnviando(false) }
  }

  if (orden.estado === 'enviado') {
    return (
      <div style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
        ✓ Pedido creado en Siesa{orden.siesa_consecutivo ? <>: <strong>{orden.siesa_consecutivo}</strong></> : ''}
        {orden.enviado_at && <> · {new Date(orden.enviado_at).toLocaleString('es-CO')}</>}
      </div>
    )
  }

  const alertas = prep?.avisos.filter(a => a.nivel === 'alerta').length ?? 0

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>Pedido en Siesa</strong>
        <button className="btn" onClick={preparar} disabled={cargando || orden.estado === 'descartada'}>
          {cargando ? 'Validando con Siesa...' : prep ? 'Volver a validar' : 'Preparar pedido'}
        </button>
      </div>

      {orden.estado === 'error' && !prep && orden.siesa_respuesta != null && (
        <details style={{ marginTop: 8, fontSize: 12 }}>
          <summary style={{ color: 'var(--danger)', cursor: 'pointer' }}>Siesa rechazó el último envío (ver respuesta)</summary>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: 8, borderRadius: 6 }}>{JSON.stringify(orden.siesa_respuesta, null, 2)}</pre>
        </details>
      )}

      {prep && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {prep.resumen.cliente} · {prep.resumen.tipoDocto} · bodega {prep.resumen.bodega} · lista {prep.resumen.listaPrecio || '—'} ·
            cond. pago {prep.resumen.condPago || '—'} · entrega {prep.resumen.fechaEntrega} ({prep.resumen.diasEntrega} días)
          </div>
          {prep.avisos.length === 0 && <div style={{ ...estiloAviso('info') }}>✓ Sin observaciones: el pedido está listo para enviar.</div>}
          {prep.avisos.map((a, i) => <div key={i} style={estiloAviso(a.nivel)}>{COLOR[a.nivel].icono} {a.mensaje}</div>)}

          <button className="btn" style={{ justifySelf: 'start', fontSize: 12 }} onClick={() => setVerJson(v => !v)}>{verJson ? 'Ocultar' : 'Ver'} JSON que se enviará</button>
          {verJson && <pre style={{ fontSize: 11, maxHeight: 260, overflow: 'auto', background: 'var(--bg)', padding: 8, borderRadius: 6 }}>{JSON.stringify(prep.documento, null, 2)}</pre>}

          {prep.puedeEnviar && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {alertas > 0 && (
                <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={confirma} onChange={e => setConfirma(e.target.checked)} />
                  Revisé las {alertas} alerta(s) y quiero crear el pedido así
                </label>
              )}
              <button className="btn btn-primary" onClick={enviar} disabled={enviando || (alertas > 0 && !confirma)} style={{ marginLeft: 'auto' }}>
                {enviando ? 'Enviando a Siesa...' : 'Crear pedido en Siesa'}
              </button>
            </div>
          )}
        </div>
      )}

      {mensaje && (
        <div style={{ ...estiloAviso(mensaje.ok ? 'info' : 'bloqueo'), marginTop: 8 }}>
          {mensaje.texto}
          {mensaje.detalle != null && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 6 }}>{JSON.stringify(mensaje.detalle, null, 2)}</pre>}
        </div>
      )}
    </div>
  )
}

function estiloAviso(nivel: Aviso['nivel']): React.CSSProperties {
  return { background: COLOR[nivel].bg, color: COLOR[nivel].fg, borderRadius: 6, padding: '8px 10px', fontSize: 13 }
}
