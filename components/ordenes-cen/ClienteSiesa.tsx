'use client'
import { useEffect, useState } from 'react'

type Respuesta = {
  asociada: boolean
  siesa?: Record<string, unknown> | null
  app?: {
    bodega: string | null; ciudad: string | null; departamento: string | null; direccion?: string | null
    config: Record<string, string | null> | null
    ean_orden?: string; eans?: string[] // EAN del punto de la orden y los que el sistema tiene asociados a la sucursal
  }
  error?: string
}

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
  // EAN: el del punto de entrega de la orden contra los que el sistema tiene asociados a esta sucursal
  const eanOrden = data?.app?.ean_orden ?? ''
  const eans = data?.app?.eans ?? []
  const eanCoincide = !eanOrden || eans.includes(eanOrden)
  const campos: [string, string, boolean?, boolean?][] = c ? [
    ['Sucursal en Siesa', `${t(c.f201_id_sucursal)} · ${t(c.f201_descripcion_sucursal)}`],
    ['Estado', Number(c.f201_ind_estado_activo) === 1 ? 'Activa' : 'INACTIVA', Number(c.f201_ind_estado_activo) !== 1],
    ['Lista de precios', t(cfg?.lista_precio) !== '—' ? `${t(cfg?.lista_precio)} (config. app; Siesa: ${t(c.f201_id_lista_precio)})` : t(c.f201_id_lista_precio)],
    ['CO / tipo de documento', `${t(cfg?.id_co ?? '001')} / ${t(cfg?.tipo_docto ?? 'PVS')}`],
    ['Dirección', [t(data?.app?.direccion), [data?.app?.ciudad, data?.app?.departamento].filter(Boolean).join(', ')].filter(x => x && x !== '—').join(' · ') || '—', false, true],
    ['EAN del punto en el sistema', eans.length
      ? `${eans.join(', ')}${eanCoincide ? ' ✓ coincide con la orden' : ` · ⚠ la orden trae ${eanOrden}`}`
      : 'Sin EAN asociado a esta sucursal', !eanCoincide || !eans.length, true],
  ] : []

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>Cliente en Siesa · {nit}/{sucursal}</strong>
        <span style={{ fontSize: 11, color: 'var(--text2)' }} title="Son los datos con que se arma el pedido">
          <a href="/logistica/ordenes-cen/clientes">Config. de clientes</a> · <a href="/logistica/ordenes-cen/sucursales">Sucursales</a>
        </span>
      </div>
      {!data && <div style={{ fontSize: 13, color: 'var(--text2)' }}>Consultando Siesa...</div>}
      {data?.error && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{data.error}</div>}
      {data && !data.error && !c && (
        <div style={{ fontSize: 13, color: 'var(--danger)' }}>La sucursal {nit}/{sucursal} no existe como cliente en Siesa: revisa la asociación del punto de entrega.</div>
      )}
      {c && (
        // Compacto: los datos cortos comparten fila; dirección y EAN ocupan más ancho, sin dejar huecos
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {campos.map(([k, v, malo, ancho]) => (
            <div key={k} style={{ background: 'var(--bg)', borderRadius: 6, padding: '4px 8px', flex: ancho ? '2 1 300px' : '1 1 150px', minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text2)', fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: malo ? 'var(--danger)' : undefined, overflowWrap: 'anywhere' }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
