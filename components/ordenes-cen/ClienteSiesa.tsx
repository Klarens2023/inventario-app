'use client'
import { useEffect, useState } from 'react'
import { fmtMoneda } from './utils'

type Respuesta = {
  asociada: boolean
  siesa?: Record<string, unknown> | null
  app?: { bodega: string | null; ciudad: string | null; departamento: string | null; config: Record<string, string | null> | null }
  error?: string
}

const si = (v: unknown) => Number(v) === 1 ? 'Sí' : 'No'
const t = (v: unknown) => (v === null || v === undefined || String(v).trim() === '') ? '—' : String(v).trim()

// Datos del cliente/sucursal en Siesa, para rectificarlos antes de crear el pedido.
export function ClienteSiesa({ ordenId, nit, sucursal }: { ordenId: number; nit: string | null; sucursal: string | null }) {
  const [data, setData] = useState<Respuesta | null>(null)

  useEffect(() => {
    if (!nit) return
    setData(null)
    fetch(`/api/logistica/ordenes-cen/${ordenId}/cliente`).then(r => r.json()).then(setData)
      .catch(() => setData({ asociada: true, error: 'No se pudo consultar el cliente' }))
  }, [ordenId, nit, sucursal])

  if (!nit) return null

  const c = data?.siesa
  const cfg = data?.app?.config
  const campos: [string, string, boolean?][] = c ? [
    ['Sucursal en Siesa', `${t(c.f201_id_sucursal)} · ${t(c.f201_descripcion_sucursal)}`],
    ['Estado', Number(c.f201_ind_estado_activo) === 1 ? 'Activa' : 'INACTIVA', Number(c.f201_ind_estado_activo) !== 1],
    ['Lista de precios', t(cfg?.lista_precio) !== '—' ? `${t(cfg?.lista_precio)} (config. app; Siesa: ${t(c.f201_id_lista_precio)})` : t(c.f201_id_lista_precio)],
    ['Condición de pago', t(cfg?.cond_pago) !== '—' ? `${t(cfg?.cond_pago)} (config. app; Siesa: ${t(c.f201_id_cond_pago)})` : t(c.f201_id_cond_pago)],
    ['Tipo de cliente', t(c.f201_id_tipo_cli)],
    ['Bodega (sucursal en app)', t(data?.app?.bodega ?? '00110')],
    ['Vendedor', t(c.f201_id_vendedor)],
    ['Cupo de crédito', c.f201_cupo_credito !== null && c.f201_cupo_credito !== undefined ? fmtMoneda(Number(c.f201_cupo_credito)) : '—'],
    ['Calificación', t(c.f201_ind_calificacion)],
    ['Bloqueo por cupo / mora', `${si(c.f201_ind_bloqueo_cupo)} / ${si(c.f201_ind_bloqueo_mora)}`],
    ['Ciudad', [data?.app?.ciudad, data?.app?.departamento].filter(Boolean).join(', ') || '—'],
    ['CO / tipo de documento', `${t(cfg?.id_co ?? '001')} / PVS`],
  ] : []

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>Cliente en Siesa · {nit}/{sucursal}</strong>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          Revisa estos datos: son los que se usan para armar el pedido. <a href="/logistica/ordenes-cen/clientes">Configuración de clientes</a> · <a href="/logistica/ordenes-cen/sucursales">Sucursales</a>
        </span>
      </div>
      {!data && <div style={{ fontSize: 13, color: 'var(--text2)' }}>Consultando Siesa...</div>}
      {data?.error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{data.error}</div>}
      {data && !data.error && !c && (
        <div style={{ fontSize: 13, color: 'var(--danger)' }}>La sucursal {nit}/{sucursal} no existe como cliente en Siesa: revisa la asociación del punto de entrega.</div>
      )}
      {c && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {campos.map(([k, v, malo]) => (
            <div key={k} style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: malo ? 'var(--danger)' : undefined }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
