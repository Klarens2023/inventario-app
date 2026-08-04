'use client'
import { useState } from 'react'
import type { PagoAdmin, PuntoVenta, SortKey } from '@/types/pvn-pagos-admin'
import { fmtFechaHora, fmtFecha, fmtMoneda } from './utils'
import { inp, iconBtn, iconBtnConfirmar, iconBtnCancelar, colHeaderBtn } from './constants'
import { Lightbox } from './Lightbox'

type Props = {
  pagos: PagoAdmin[]
  loading: boolean
  puntos: PuntoVenta[]
  isAdmin: boolean
  sortBy: SortKey
  sortDir: 'asc' | 'desc'
  onToggleSort: (key: SortKey) => void

  editandoId: number | null
  valorEdit: string
  onValorEditChange: (v: string) => void
  puntoEdit: string
  onPuntoEditChange: (v: string) => void
  guardandoEdit: boolean
  onIniciarEdicion: (p: PagoAdmin) => void
  onGuardarEdicion: (id: number) => void
  onCancelarEdicion: () => void
  eliminandoId: number | null
  onEliminarPago: (p: PagoAdmin) => void
}

export function PagosTable({
  pagos, loading, puntos, isAdmin, sortBy, sortDir, onToggleSort,
  editandoId, valorEdit, onValorEditChange, puntoEdit, onPuntoEditChange, guardandoEdit,
  onIniciarEdicion, onGuardarEdicion, onCancelarEdicion, eliminandoId, onEliminarPago,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const puntosNacionales = puntos.filter(p => p.tipo === 'nacional')
  const puntosPrincipales = puntos.filter(p => p.tipo === 'principal')

  const pagosOrdenados = [...pagos].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'fecha') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    else if (sortBy === 'punto') cmp = (a.punto_venta_nombre ?? '').localeCompare(b.punto_venta_nombre ?? '')
    else if (sortBy === 'usuario') cmp = a.usuario_nombre.localeCompare(b.usuario_nombre)
    else if (sortBy === 'valor') cmp = Number(a.valor) - Number(b.valor)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function flecha(key: SortKey) {
    if (sortBy !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      {!loading && pagos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ width: 44, flexShrink: 0 }} />
          <button onClick={() => onToggleSort('fecha')} style={{ ...colHeaderBtn, minWidth: 150 }}>Fecha{flecha('fecha')}</button>
          <button onClick={() => onToggleSort('punto')} style={{ ...colHeaderBtn, width: 140 }}>Punto de venta{flecha('punto')}</button>
          <button onClick={() => onToggleSort('usuario')} style={{ ...colHeaderBtn, flex: 1 }}>Usuario{flecha('usuario')}</button>
          <button onClick={() => onToggleSort('valor')} style={{ ...colHeaderBtn, width: 100, justifyContent: 'flex-end' }}>Valor{flecha('valor')}</button>
          {isAdmin && <div style={{ width: 68, flexShrink: 0 }} />}
        </div>
      )}
      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
      {!loading && pagos.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay pagos en el período</div>
      )}
      {!loading && pagosOrdenados.map((p, i) => (
        <div
          key={p.id}
          style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', gap: 14,
            borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          <img
            src={`${p.foto_url}&thumb=1`} alt="Comprobante" onClick={() => setLightboxIndex(i)}
            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0, cursor: 'pointer' }}
          />
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>Turno {fmtFecha(p.fecha)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Subido {fmtFechaHora(p.created_at)}</div>
          </div>

          {editandoId === p.id ? (
            <select value={puntoEdit} onChange={e => onPuntoEditChange(e.target.value)} style={{ ...inp, fontSize: 12, padding: '5px 8px' }}>
              <option value="">— Punto de venta —</option>
              {puntosNacionales.length > 0 && (
                <optgroup label="Nacionales (PVN)">
                  {puntosNacionales.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
                </optgroup>
              )}
              {puntosPrincipales.length > 0 && (
                <optgroup label="Principales (PVV)">
                  {puntosPrincipales.map(pv => <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>)}
                </optgroup>
              )}
            </select>
          ) : (
            p.punto_venta_nombre && (
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', whiteSpace: 'nowrap' }}>
                {p.punto_venta_nombre}
              </span>
            )
          )}

          <div style={{ flex: 1, fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.usuario_nombre}
          </div>

          {editandoId === p.id ? (
            <>
              <input
                type="number"
                inputMode="numeric"
                value={valorEdit}
                onChange={e => onValorEditChange(e.target.value)}
                autoFocus
                style={{ width: 100, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700, color: '#0f172a' }}
              />
              <button onClick={() => onGuardarEdicion(p.id)} disabled={guardandoEdit} title="Guardar" style={{ ...iconBtn, ...iconBtnConfirmar, opacity: guardandoEdit ? 0.6 : 1 }}>✓</button>
              <button onClick={onCancelarEdicion} title="Cancelar" style={{ ...iconBtn, ...iconBtnCancelar }}>×</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', whiteSpace: 'nowrap' }}>
                {fmtMoneda(p.valor)}
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => onIniciarEdicion(p)} title="Editar valor / punto de venta" style={iconBtn}>✏️</button>
                  <button onClick={() => onEliminarPago(p)} disabled={eliminandoId === p.id} title="Eliminar pago" style={{ ...iconBtn, opacity: eliminandoId === p.id ? 0.5 : 1 }}>🗑️</button>
                </>
              )}
            </>
          )}
        </div>
      ))}

      {lightboxIndex !== null && (
        <Lightbox
          items={pagosOrdenados.map(p => ({
            src: p.foto_url,
            info: [
              { label: 'Fecha del turno', value: fmtFecha(p.fecha) },
              { label: 'Subido', value: fmtFechaHora(p.created_at) },
              { label: 'Punto de venta', value: p.punto_venta_nombre ?? '' },
              { label: 'Usuario', value: p.usuario_nombre },
              { label: 'Valor', value: fmtMoneda(p.valor) },
            ],
          }))}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
