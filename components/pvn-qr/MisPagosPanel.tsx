'use client'
import type { Pago, TurnoHist } from '@/types/pvn-qr'
import { fmtMoneda, fmtHora } from './utils'
import { btnDanger, iconBtn, iconBtnConfirmar, iconBtnCancelar, linkBtn, filaTurno } from './constants'

type Props = {
  nombrePunto?: string
  necesitaTurno: boolean

  mostrarListaTurnos: boolean
  onMostrarListaTurnos: () => void
  turnosHist: TurnoHist[]
  cargandoTurnosHist: boolean
  verTurnoId: number | null
  onVerTurnoActual: () => void
  onVerTurnoAnterior: (t: TurnoHist) => void

  pagosHoy: Pago[]
  cargandoPagos: boolean
  onSetLightbox: (url: string) => void

  editandoId: number | null
  valorEdit: string
  onValorEditChange: (v: string) => void
  guardandoEdit: boolean
  onIniciarEdicion: (p: Pago) => void
  onGuardarEdicion: (id: number) => void
  onCancelarEdicion: () => void
  eliminandoId: number | null
  onEliminarPago: (id: number) => void

  cerrando: boolean
  onCerrarTurno: () => void
  onClose: () => void
}

export function MisPagosPanel({
  nombrePunto, necesitaTurno,
  mostrarListaTurnos, onMostrarListaTurnos, turnosHist, cargandoTurnosHist, verTurnoId, onVerTurnoActual, onVerTurnoAnterior,
  pagosHoy, cargandoPagos, onSetLightbox,
  editandoId, valorEdit, onValorEditChange, guardandoEdit, onIniciarEdicion, onGuardarEdicion, onCancelarEdicion, eliminandoId, onEliminarPago,
  cerrando, onCerrarTurno, onClose,
}: Props) {
  const totalHoy = pagosHoy.reduce((s, p) => s + Number(p.valor), 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#f1f5f9', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 12px' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              {mostrarListaTurnos ? 'Turnos de hoy' : verTurnoId ? 'Turno anterior' : 'Mis pagos de hoy'}
            </div>
            {!mostrarListaTurnos && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {verTurnoId ? `🔒 ${turnosHist.find(t => t.id === verTurnoId)?.punto_venta_nombre} · solo lectura` : nombrePunto}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#475569' }}>×</button>
        </div>

        {!mostrarListaTurnos && (
          <div style={{ padding: '0 20px 12px' }}>
            {verTurnoId ? (
              <button onClick={onVerTurnoActual} style={linkBtn}>← Volver al turno actual</button>
            ) : (
              <button onClick={onMostrarListaTurnos} style={linkBtn}>🕐 Turnos anteriores de hoy</button>
            )}
          </div>
        )}

        {mostrarListaTurnos ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
            {cargandoTurnosHist && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Cargando...</div>}
            {!cargandoTurnosHist && turnosHist.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>Sin turnos hoy</div>}
            {!cargandoTurnosHist && turnosHist.map(t => (
              <button key={t.id} onClick={() => onVerTurnoAnterior(t)} style={filaTurno}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{t.punto_venta_nombre}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {fmtHora(t.abierto_at)} – {t.cerrado_at ? fmtHora(t.cerrado_at) : (t.activo ? 'en curso' : '—')}
                  </div>
                </div>
                <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        ) : (
          <>
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
              {!cargandoPagos && pagosHoy.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>Sin pagos</div>}
              {!cargandoPagos && pagosHoy.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={p.foto_url} alt="" onClick={() => onSetLightbox(p.foto_url)}
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{fmtHora(p.created_at)}</span>
                  <span style={{ flex: 1 }} />
                  {verTurnoId !== null ? (
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{fmtMoneda(Number(p.valor))}</span>
                  ) : editandoId === p.id ? (
                    <>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={valorEdit}
                        onChange={e => onValorEditChange(e.target.value)}
                        autoFocus
                        style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700, color: '#0f172a' }}
                      />
                      <button onClick={() => onGuardarEdicion(p.id)} disabled={guardandoEdit} title="Guardar" style={{ ...iconBtn, ...iconBtnConfirmar, opacity: guardandoEdit ? 0.6 : 1 }}>✓</button>
                      <button onClick={onCancelarEdicion} title="Cancelar" style={{ ...iconBtn, ...iconBtnCancelar }}>×</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{fmtMoneda(Number(p.valor))}</span>
                      <button onClick={() => onIniciarEdicion(p)} title="Editar valor" style={iconBtn}>✏️</button>
                      <button onClick={() => onEliminarPago(p.id)} disabled={eliminandoId === p.id} title="Eliminar" style={{ ...iconBtn, opacity: eliminandoId === p.id ? 0.5 : 1 }}>🗑️</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {necesitaTurno && verTurnoId === null && (
              <div style={{ padding: '16px 20px 0' }}>
                <button
                  onClick={onCerrarTurno}
                  disabled={cerrando || editandoId !== null}
                  style={{ ...btnDanger, width: '100%', opacity: (cerrando || editandoId !== null) ? 0.5 : 1, cursor: (cerrando || editandoId !== null) ? 'not-allowed' : 'pointer' }}
                >
                  {cerrando ? 'Cerrando...' : `⏹ Cerrar turno${pagosHoy.length > 0 ? ` · ${fmtMoneda(totalHoy)}` : ''}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
