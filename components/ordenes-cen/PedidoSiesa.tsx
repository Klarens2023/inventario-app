'use client'
import { useState } from 'react'
import type { OrdenCen } from '@/types/ordenes-cen'
import { ItemSiesaPicker, type ItemSiesa } from './ItemSiesaPicker'

type Aviso = { nivel: 'bloqueo' | 'alerta' | 'info'; mensaje: string }
type SinItem = { ean: string; descripcion: string | null; peso_kg: number | null; lineas: number[] }
type Prep = {
  documento: unknown
  avisos: Aviso[]
  puedeEnviar: boolean
  resumen: { cliente: string; listaPrecio: string; condPago: string; bodega: string; origenBodega: string; tipoDocto: string; consecutivo: string; fechaEntrega: string; diasEntrega: number }
  sinItem?: SinItem[]
}

const COLOR: Record<Aviso['nivel'], { bg: string; fg: string; icono: string }> = {
  bloqueo: { bg: '#FEE2E2', fg: '#991B1B', icono: '⛔' },
  alerta: { bg: '#FEF3C7', fg: '#92400E', icono: '⚠' },
  info: { bg: '#E0ECFF', fg: '#1E3A8A', icono: 'ℹ' },
}

// Sección del detalle de la orden: valida y crea el pedido de venta en Siesa.
export function PedidoSiesa({ orden, onEnviado, onAsignarPunto, onProductoAsignado }: { orden: OrdenCen & { siesa_consecutivo?: string | null; siesa_respuesta?: unknown; enviado_at?: string | null }; onEnviado: () => void; onAsignarPunto: () => void; onProductoAsignado?: () => void }) {
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

  // Sin sucursal de Siesa no se puede consultar el cliente (lista de precios, condición de pago):
  // primero se asigna la sucursal.
  if (!orden.nit) {
    return (
      <div style={{ border: '1px solid #F59E0B', background: '#FFFBEB', borderRadius: 8, padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: '#92400E', flex: 1, minWidth: 260 }}>
          <strong>Pedido en Siesa:</strong> el punto de entrega (EAN {orden.ean_entrega}) no está asociado a una sucursal de Siesa.
          Asígnala para traer del cliente la lista de precios, la condición de pago y la bodega.
        </div>
        <button className="btn btn-primary" onClick={onAsignarPunto}>Asignar sucursal</button>
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
            {prep.resumen.cliente} · pedido <strong>{prep.resumen.consecutivo}</strong> (siguiente consecutivo en Siesa) · bodega {prep.resumen.bodega} ({prep.resumen.origenBodega}) · lista {prep.resumen.listaPrecio || '—'} ·
            cond. pago {prep.resumen.condPago || '—'} · entrega {prep.resumen.fechaEntrega} ({prep.resumen.diasEntrega} días)
          </div>
          {prep.avisos.length === 0 && <div style={{ ...estiloAviso('info') }}>✓ Sin observaciones: el pedido está listo para enviar.</div>}
          {prep.avisos.map((a, i) => <div key={i} style={estiloAviso(a.nivel)}>{COLOR[a.nivel].icono} {a.mensaje}</div>)}

          {(prep.sinItem?.length ?? 0) > 0 && (
            <div style={{ border: '1px solid #FCA5A5', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                <strong>Productos nuevos sin ítem de Siesa.</strong> Asígnalo aquí: queda guardado en Productos y las siguientes órdenes con ese código de barras ya lo traen.
              </div>
              {prep.sinItem!.map(p => <AsignarItem key={p.ean} producto={p} onGuardado={() => { onProductoAsignado?.(); preparar() }} />)}
            </div>
          )}

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

// Asigna el ítem de Siesa a un código de barras que llegó en la orden y no está en Productos.
// Si Siesa maneja el ítem por kilo, pide el peso por unidad (ej. 2.5 para una barra de 2,5 kg),
// que es con lo que se convierten las órdenes que vienen en unidades.
function AsignarItem({ producto, onGuardado }: { producto: SinItem; onGuardado: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [f120, setF120] = useState('')
  const [item, setItem] = useState<ItemSiesa | null>(null)
  const [peso, setPeso] = useState(producto.peso_kg ? String(producto.peso_kg) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const porKilo = item?.unidad?.trim().toUpperCase() === 'KG'

  async function guardar() {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/productos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ean: producto.ean, f120_id: f120, peso_kg: peso }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar'); return }
      onGuardado() // vuelve a validar el pedido con el ítem ya asignado
    } finally { setGuardando(false) }
  }

  return (
    <div style={{ background: 'var(--bg)', borderRadius: 6, padding: 8, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
        <span style={{ fontFamily: 'monospace' }}>{producto.ean}</span>
        <span style={{ flex: 1, minWidth: 160 }}>{producto.descripcion || 'Sin descripción'} · línea{producto.lineas.length > 1 ? 's' : ''} {producto.lineas.join(', ')}</span>
        {!abierto && <button className="btn" style={{ fontSize: 12 }} onClick={() => setAbierto(true)}>Asignar ítem</button>}
      </div>
      {abierto && (
        <>
          <ItemSiesaPicker value={f120} onChange={(id, i) => { setF120(id); setItem(i) }}
            sugerencia={(producto.descripcion ?? '').split(' ').slice(0, 2).join(' ')} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
            <span>{item ? <>Ítem <strong>{item.f120_id}</strong> · {item.descripcion}</> : 'Elige el ítem de la lista'}</span>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              Peso por unidad (kg){porKilo ? ' *' : ''}
              <input value={peso} onChange={e => setPeso(e.target.value)} placeholder={porKilo ? 'ej. 2.5' : 'opcional'} inputMode="decimal"
                style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: `1px solid ${porKilo && !peso ? '#F59E0B' : 'var(--border)'}` }} />
            </label>
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={guardar} disabled={guardando || !f120 || (porKilo && !peso)}>
              {guardando ? 'Guardando...' : 'Guardar y volver a validar'}
            </button>
            <button className="btn" onClick={() => { setAbierto(false); setError('') }} disabled={guardando}>Cancelar</button>
          </div>
          {porKilo && <div style={{ fontSize: 12, color: '#92400E' }}>Siesa maneja este ítem por kilo: con el peso por unidad se convierten a KG las órdenes que llegan en unidades.</div>}
          {error && <div style={{ ...estiloAviso('bloqueo') }}>{error}</div>}
        </>
      )}
    </div>
  )
}

function estiloAviso(nivel: Aviso['nivel']): React.CSSProperties {
  return { background: COLOR[nivel].bg, color: COLOR[nivel].fg, borderRadius: 6, padding: '8px 10px', fontSize: 13 }
}
