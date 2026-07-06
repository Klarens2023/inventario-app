'use client'
import { useEffect, useState } from 'react'
import type { MovimientoDetalle as TDetalle } from '@/types/movimientos'
import { fetchMovimientoDetalle, actualizarEstado } from '@/lib/api/movimientos'
import { imprimirMovimiento } from './imprimirMovimiento'
import { Badge, SecCard, Item } from './shared'
import { btnSec } from './styles'

type Props = {
  id: string
  isAdmin: boolean
  onVolver: () => void
  onEstadoCambiado: () => void
}

export function MovimientoDetalle({ id, isAdmin, onVolver, onEstadoCambiado }: Props) {
  const [detalle,         setDetalle]         = useState<TDetalle | null>(null)
  const [cargando,        setCargando]        = useState(true)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  useEffect(() => {
    setCargando(true)
    fetchMovimientoDetalle(id)
      .then(setDetalle)
      .finally(() => setCargando(false))
  }, [id])

  async function handleCambiarEstado(estado: string) {
    if (!detalle) return
    setCambiandoEstado(true)
    const ok = await actualizarEstado(detalle.id, estado)
    if (ok) {
      setDetalle(prev => prev ? { ...prev, estado } : prev)
      onEstadoCambiado()
    }
    setCambiandoEstado(false)
  }

  if (cargando || !detalle) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#94a3b8' }}>Cargando...</span>
    </div>
  )

  return (
    <div style={{ padding: '24px 20px', maxWidth: 860, margin: '0 auto' }}>
      <button onClick={onVolver} style={{ ...btnSec, marginBottom: 20 }}>← Volver</button>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>{detalle.id}</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {detalle.fecha} · Registrado por {detalle.registrado_por}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Badge estado={detalle.estado} />
          <button onClick={() => imprimirMovimiento(detalle, window.location.origin)} style={{ ...btnSec, fontSize: 13 }}>
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Cards info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <SecCard title="Movimiento">
          <Item label="Tipo" val={detalle.movimiento === 'temporal' ? 'Temporal' : 'Definitivo'} />
          <Item label="Tipo de movimiento" val={detalle.tipo_movimiento} />
          <Item label="Motivo" val={detalle.motivo} />
        </SecCard>

        <SecCard title="Estado">
          <div style={{ marginBottom: 10 }}><Badge estado={detalle.estado} /></div>
          {isAdmin && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['autorizado', 'entregado', 'recibido', 'cerrado'].map(e => (
                <button key={e}
                  disabled={cambiandoEstado || detalle.estado === e}
                  onClick={() => handleCambiarEstado(e)}
                  style={{ ...btnSec, fontSize: 11, padding: '4px 10px',
                    opacity: detalle.estado === e ? 0.4 : 1,
                    background: detalle.estado === e ? '#f1f5f9' : '#fff' }}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </SecCard>

        <SecCard title="Origen (Entrega)">
          <Item label="Nombre"    val={detalle.origen_nombre} />
          <Item label="Documento" val={detalle.origen_documento} />
          <Item label="Área"      val={detalle.origen_area} />
        </SecCard>

        <SecCard title="Destino (Recibe)">
          <Item label="Nombre"    val={detalle.destino_nombre} />
          <Item label="Documento" val={detalle.destino_documento} />
          <Item label="Área"      val={detalle.destino_area} />
        </SecCard>
      </div>

      {/* Tabla activos */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
          Activos ({detalle.activos.length})
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Placa', 'Descripción', 'Tipo', 'Serie', 'Cantidad'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detalle.activos.map(a => (
                <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0047BA', fontFamily: 'monospace' }}>{a.equipo_id}</td>
                  <td style={{ padding: '10px 14px', color: '#1e293b' }}>{a.descripcion}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{a.tipo_activo}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{a.numero_serie || '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>{a.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detalle.observaciones && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Observaciones</div>
          <div style={{ fontSize: 13, color: '#334155' }}>{detalle.observaciones}</div>
        </div>
      )}
    </div>
  )
}
