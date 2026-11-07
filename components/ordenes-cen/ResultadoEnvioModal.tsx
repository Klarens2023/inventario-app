'use client'
import { fmtMoneda } from './utils'

// Modal con el resultado de crear pedidos en Siesa y del aviso por correo a facturación:
// cómo quedó cada pedido (creado, retenido, no se creó) y si el correo salió, a quién y con qué pedidos.
// Se usa en el envío individual (PedidoSiesa), en el envío en bloque y en "Avisar a facturación" de la ruta.

/** Un pedido del envío. */
export type FilaResultado = {
  id: number
  pedido?: string | null // PVS-123
  oc?: string | null
  cliente?: string | null
  valor?: number | null
  ok: boolean
  retenido?: string | null
  mensaje?: string
}

/** Respuesta del aviso a facturación (lib/cen/avisoFacturacion.ts → ResultadoAviso). */
export type AvisoCorreo = {
  ok: boolean
  mensaje: string
  detalle?: { id: number; pedido: string; oc: string | null; institucional: boolean; razon_social: string; relacion: string; valor: number; retenido: string | null }[]
  para?: string[]
  cc?: string[]
}

type Estado = 'creado' | 'retenido' | 'error' | 'institucional'
const ESTADO: Record<Estado, { label: string; bg: string; fg: string }> = {
  creado: { label: '✓ Creado en Siesa', bg: '#D1FAE5', fg: '#065F46' },
  retenido: { label: '⚠ Retenido en Siesa', bg: '#FEF3C7', fg: '#92400E' },
  error: { label: '✗ No se creó', bg: '#FEE2E2', fg: '#991B1B' },
  institucional: { label: 'Institucional', bg: '#EDE9FE', fg: '#5B21B6' },
}

export function ResultadoEnvioModal({ titulo, filas, aviso, onClose }: { titulo: string; filas: FilaResultado[]; aviso?: AvisoCorreo | null; onClose: () => void }) {
  const enCorreo = new Set(aviso?.ok ? (aviso.detalle ?? []).map(p => p.id) : [])
  // Lo que se envió más lo que el correo agregó (institucionales de las mismas relaciones, o todo en el aviso por ruta)
  const ids = new Set(filas.map(f => f.id))
  const extra = (aviso?.ok ? aviso.detalle ?? [] : []).filter(p => !ids.has(p.id))
  const todas: (FilaResultado & { estado: Estado; relacion?: string })[] = [
    ...filas.map(f => {
      const d = aviso?.detalle?.find(p => p.id === f.id)
      const retenido = f.retenido ?? d?.retenido
      return { ...f, retenido, relacion: d?.relacion, estado: (!f.ok ? 'error' : retenido ? 'retenido' : 'creado') as Estado }
    }),
    ...extra.map(p => ({
      id: p.id, pedido: p.pedido, oc: p.oc, cliente: p.razon_social, valor: p.valor, ok: true, retenido: p.retenido, relacion: p.relacion,
      estado: (p.institucional ? 'institucional' : p.retenido ? 'retenido' : 'creado') as Estado,
    })),
  ]
  const cuenta = (e: Estado) => todas.filter(f => f.estado === e).length
  const huboCreados = todas.some(f => f.ok)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <div onClick={e => e.stopPropagation()} className="card" role="dialog" aria-modal="true" aria-label={titulo}
        style={{ width: '100%', maxWidth: 860, maxHeight: '94vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{titulo}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {(['creado', 'retenido', 'error', 'institucional'] as Estado[]).filter(e => cuenta(e) > 0).map(e => (
            <span key={e} style={{ background: ESTADO[e].bg, color: ESTADO[e].fg, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
              {cuenta(e)} · {ESTADO[e].label.replace(/^[✓⚠✗] /, '')}
            </span>
          ))}
        </div>

        {/* Estado del correo a facturación */}
        {aviso ? (
          <div style={{ borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 14,
            background: aviso.ok ? '#ECFDF5' : '#FFFBEB', border: `1px solid ${aviso.ok ? '#6EE7B7' : '#FCD34D'}`, color: aviso.ok ? '#065F46' : '#92400E' }}>
            <strong>{aviso.ok && enCorreo.size ? '📧 Correo enviado a facturación' : aviso.ok ? '📧 Aviso a facturación' : '⚠ No se envió el correo a facturación'}</strong>
            <div style={{ fontSize: 13, marginTop: 2 }}>{aviso.mensaje}</div>
            {aviso.ok && enCorreo.size > 0 && (aviso.para?.length ?? 0) > 0 && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Para: {aviso.para!.join(', ')}{aviso.cc?.length ? <> · CC: {aviso.cc.join(', ')}</> : null}
              </div>
            )}
          </div>
        ) : huboCreados ? (
          <div style={{ borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E' }}>
            ⚠ No hubo respuesta del aviso a facturación. Usa “Avisar a facturación” en la ruta para enviarlo.
          </div>
        ) : null}

        {todas.length > 0 && <div className="cen-scroll" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
          <table className="inv-table cen-tabla cen-tarjetas">
            <thead><tr><th>Pedido</th><th>OC</th><th>Cliente</th><th>Estado</th><th>Correo</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
            <tbody>
              {todas.map(f => (
                <tr key={f.id}>
                  <td data-label="Pedido" className="nw"><strong>{f.pedido || '—'}</strong>{f.relacion && <span className="sub">{f.relacion}</span>}</td>
                  <td data-label="OC" className="mono nw">{f.oc || '—'}</td>
                  <td data-label="Cliente">{f.cliente || '—'}</td>
                  <td data-label="Estado">
                    <span style={{ background: ESTADO[f.estado].bg, color: ESTADO[f.estado].fg, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {ESTADO[f.estado].label}
                    </span>
                    {(f.estado === 'error' || f.retenido) && <div style={{ fontSize: 12, marginTop: 4, color: ESTADO[f.estado].fg }}>{f.estado === 'error' ? f.mensaje : f.retenido}</div>}
                  </td>
                  <td data-label="Correo" className="nw" style={{ fontSize: 12 }}>
                    {enCorreo.has(f.id) ? <span style={{ color: '#047857', fontWeight: 700 }}>📧 Avisado</span> : f.ok ? <span style={{ color: '#B45309' }}>Sin avisar</span> : '—'}
                  </td>
                  <td data-label="Valor" className="num">{f.valor != null ? fmtMoneda(f.valor) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={onClose} autoFocus>Entendido</button>
        </div>
      </div>
    </div>
  )
}
