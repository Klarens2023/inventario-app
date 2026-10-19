'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { OrdenCen, EstadoOrdenCen, ResultadoSincronizacion } from '@/types/ordenes-cen'
import { COMPRADORES, nombreComprador } from '@/lib/cen/compradores'
import { DetalleOrdenModal } from '@/components/ordenes-cen/DetalleOrdenModal'
import { AsignarPuntoModal } from '@/components/ordenes-cen/AsignarPuntoModal'
import { ESTADOS, fmtFecha, fmtMoneda, fmtNumero, relacion } from '@/components/ordenes-cen/utils'

type Resumen = { pendientes: number; sin_punto: number; enviadas: number; con_error: number; archivos_error: number }

const sel: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, background: '#fff' }

export default function OrdenesCenPage() {
  const [ordenes, setOrdenes] = useState<OrdenCen[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [resultadoSync, setResultadoSync] = useState<ResultadoSincronizacion[] | null>(null)
  const [error, setError] = useState('')

  const [estado, setEstado] = useState<EstadoOrdenCen | ''>('')
  const [comprador, setComprador] = useState('')
  const [fuente, setFuente] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [buscar, setBuscar] = useState('')
  const [ruta, setRuta] = useState('')
  const [vista, setVista] = useState<'punto' | 'ruta'>('punto')
  const [rutas, setRutas] = useState<string[]>([])

  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [asignarEan, setAsignarEan] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    const qs = new URLSearchParams({ estado, comprador, fuente, desde, hasta, buscar, ruta })
    try {
      const res = await fetch(`/api/logistica/ordenes-cen?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron cargar las órdenes')
      setOrdenes(data.ordenes); setResumen(data.resumen)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }, [estado, comprador, fuente, desde, hasta, buscar, ruta])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    fetch('/api/logistica/ordenes-cen/reglas').then(r => r.ok ? r.json() : []).then((rs: { ruta: string }[]) =>
      setRutas(Array.from(new Set(rs.map(r => r.ruta))).sort()))
  }, [])

  async function sincronizar() {
    setSincronizando(true); setResultadoSync(null); setError('')
    try {
      const res = await fetch('/api/logistica/ordenes-cen/sincronizar', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo sincronizar')
      setResultadoSync(data)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSincronizando(false)
    }
  }

  // Agrupa por punto de venta (sucursal de Siesa, o EAN si no está homologado) o por
  // relación de despacho (ruta + semana de entrega).
  const grupos = useMemo(() => {
    const m = new Map<string, { clave: string; titulo: string; subtitulo: string; sinPunto: boolean; ean: string; ordenes: OrdenCen[] }>()
    for (const o of ordenes) {
      let clave: string, titulo: string, subtitulo: string
      if (vista === 'ruta') {
        const rel = relacion(o.ruta, o.fecha_entrega)
        clave = rel ?? 'sin-ruta'
        titulo = rel ?? 'Sin ruta asignada'
        subtitulo = rel ? `Ruta ${o.ruta}` : 'Asigna la ruta desde el detalle de cada orden o crea una regla'
      } else {
        clave = o.nit ? `${o.nit}/${o.sucursal}` : `ean:${o.ean_entrega}`
        titulo = o.razon_social ?? `Punto sin homologar · ${nombreComprador(o.ean_comprador)}`
        subtitulo = o.nit ? `NIT ${o.nit} · Sucursal ${o.sucursal} · ${o.ciudad ?? ''} · EAN ${o.ean_entrega}` : `EAN de entrega ${o.ean_entrega}`
      }
      if (!m.has(clave)) m.set(clave, { clave, titulo, subtitulo, sinPunto: vista === 'punto' ? !o.nit : !o.ruta, ean: o.ean_entrega, ordenes: [] })
      m.get(clave)!.ordenes.push(o)
    }
    // Primero los que necesitan atención (sin punto / sin ruta)
    return Array.from(m.values()).sort((a, b) => Number(b.sinPunto) - Number(a.sinPunto) || a.titulo.localeCompare(b.titulo))
  }, [ordenes, vista])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Órdenes EDI (CEN)</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Órdenes de compra de las cadenas que llegan por Carvajal y Subrik, organizadas por punto de venta.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/logistica/ordenes-cen/sucursales" className="btn">Sucursales</Link>
          <Link href="/logistica/ordenes-cen/productos" className="btn">Productos</Link>
          <Link href="/logistica/ordenes-cen/clientes" className="btn">Configuración de clientes</Link>
          <Link href="/logistica/ordenes-cen/reglas" className="btn">Reglas de ruta</Link>
          <button className="btn btn-primary" onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? 'Trayendo órdenes...' : '⟳ Traer órdenes'}
          </button>
        </div>
      </div>

      {resultadoSync && (
        <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>
          {resultadoSync.map(r => (
            <div key={r.fuente} style={{ marginBottom: 4 }}>
              <strong>{r.fuente === 'carvajal' ? 'Carvajal (CEN)' : 'Subrik'}:</strong>{' '}
              {!r.configurada ? 'sin credenciales configuradas'
                : r.error ? <span style={{ color: 'var(--danger)' }}>no se pudo conectar ({r.error})</span>
                : <>
                    {r.nuevas} nuevas · {r.actualizadas} actualizadas
                    {r.omitidas > 0 && ` · ${r.omitidas} ya enviadas a Siesa (sin cambios)`}
                    {r.pendientesPorTraer > 0 && ` · faltan ${r.pendientesPorTraer}, vuelve a traer`}
                    {r.errores.length > 0 && <span style={{ color: 'var(--danger)' }}> · {r.errores.length} archivo(s) con error: {r.errores.map(e => `${e.archivo} (${e.error})`).join('; ')}</span>}
                  </>}
            </div>
          ))}
        </div>
      )}
      {aviso && <div className="card" style={{ marginBottom: 16, color: 'var(--accent2)', fontSize: 13 }}>{aviso}</div>}
      {error && <div className="card" style={{ marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          {([
            ['pendiente', 'Pendientes de pedido', resumen.pendientes],
            ['sin_punto', 'Sin punto asociado', resumen.sin_punto],
            ['enviado', 'Pedidos en Siesa', resumen.enviadas],
            ['error', 'Rechazadas por Siesa', resumen.con_error],
          ] as [EstadoOrdenCen, string, number][]).map(([k, label, n]) => (
            <button key={k} onClick={() => setEstado(estado === k ? '' : k)} className="card"
              style={{ textAlign: 'left', cursor: 'pointer', borderColor: estado === k ? ESTADOS[k].color : undefined }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ESTADOS[k].color }}>{n}</div>
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <select value={estado} onChange={e => setEstado(e.target.value as EstadoOrdenCen | '')} style={sel}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADOS) as EstadoOrdenCen[]).map(k => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
        </select>
        <select value={comprador} onChange={e => setComprador(e.target.value)} style={sel}>
          <option value="">Todas las cadenas</option>
          {Object.entries(COMPRADORES).map(([ean, n]) => <option key={ean} value={ean}>{n}</option>)}
        </select>
        <select value={fuente} onChange={e => setFuente(e.target.value)} style={sel}>
          <option value="">Carvajal y Subrik</option>
          <option value="carvajal">Carvajal (CEN)</option>
          <option value="subrik">Subrik</option>
        </select>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>Entrega desde <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={sel} /></label>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>hasta <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={sel} /></label>
        <select value={ruta} onChange={e => setRuta(e.target.value)} style={sel}>
          <option value="">Todas las rutas</option>
          <option value="-">Sin ruta</option>
          {rutas.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input placeholder="Buscar OC, punto, NIT o EAN" value={buscar} onChange={e => setBuscar(e.target.value)} style={{ ...sel, flex: 1, minWidth: 200 }} />
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {(['punto', 'ruta'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '8px 12px', fontSize: 13, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: vista === v ? 'var(--accent)' : '#fff', color: vista === v ? '#fff' : 'var(--text)' }}>
              {v === 'punto' ? 'Por punto de venta' : 'Por ruta'}
            </button>
          ))}
        </div>
      </div>

      {cargando && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text2)' }}>Cargando órdenes...</div>}
      {!cargando && grupos.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
          No hay órdenes con estos filtros. Usa <strong>Traer órdenes</strong> para leer las nuevas de los SFTP.
        </div>
      )}

      {!cargando && grupos.map(g => {
        const unidades = g.ordenes.reduce((s, o) => s + o.total_unidades, 0)
        const valor = g.ordenes.reduce((s, o) => s + o.valor_total, 0)
        const pesoCompleto = g.ordenes.every(o => o.peso_kg !== null)
        const peso = g.ordenes.reduce((s, o) => s + (o.peso_kg ?? 0), 0)
        return (
          <div key={g.clave} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden', borderColor: g.sinPunto ? '#F59E0B' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '12px 16px', background: g.sinPunto ? '#FFFBEB' : 'var(--bg)' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{g.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{g.subtitulo}</div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
                <span><strong>{g.ordenes.length}</strong> OC</span>
                <span><strong>{fmtNumero(unidades)}</strong> und</span>
                <span><strong>{pesoCompleto ? `${fmtNumero(peso, 1)} kg` : 'peso incompleto'}</strong></span>
                <span><strong>{fmtMoneda(valor)}</strong></span>
                {g.sinPunto && vista === 'punto' && <button className="btn btn-primary" onClick={() => setAsignarEan(g.ean)}>Asignar sucursal</button>}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="inv-table">
                <thead>
                  <tr><th>OC</th><th>Cadena</th>{vista === 'ruta' && <th>Punto de venta</th>}<th>Ruta</th><th>Fecha OC</th><th>Entrega</th><th>Productos</th><th>Unidades</th><th>Peso</th><th>Valor</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {g.ordenes.map(o => (
                    <tr key={o.id} onClick={() => setDetalleId(o.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 700 }}>{o.numero_orden}</td>
                      <td>{nombreComprador(o.ean_comprador)}{o.locales > 0 && <span style={{ color: 'var(--text2)', fontSize: 12 }}> · CEDI, {o.locales} tiendas</span>}</td>
                      {vista === 'ruta' && <td>{o.razon_social ?? `EAN ${o.ean_entrega}`}{o.ciudad && <span style={{ color: 'var(--text2)', fontSize: 12 }}> · {o.ciudad}</span>}</td>}
                      <td>{o.ruta ? <strong>{o.ruta}{o.ruta_manual && <span title="Asignada a mano" style={{ color: 'var(--text2)' }}> ✋</span>}</strong> : <span style={{ color: '#B45309' }}>Sin ruta</span>}</td>
                      <td>{fmtFecha(o.fecha_orden)}</td>
                      <td>{fmtFecha(o.fecha_entrega)}</td>
                      <td style={{ textAlign: 'right' }}>{o.lineas}</td>
                      <td style={{ textAlign: 'right' }}>{fmtNumero(o.total_unidades)}</td>
                      <td style={{ textAlign: 'right' }}>{o.peso_kg === null ? '—' : `${fmtNumero(o.peso_kg, 1)} kg`}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMoneda(o.valor_total)}</td>
                      <td>
                        <span style={{ background: ESTADOS[o.estado].bg, color: ESTADOS[o.estado].color, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          {ESTADOS[o.estado].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {detalleId !== null && <DetalleOrdenModal id={detalleId} onClose={() => setDetalleId(null)} onCambio={cargar} />}
      {asignarEan && (
        <AsignarPuntoModal
          ean={asignarEan}
          onClose={() => setAsignarEan(null)}
          onGuardado={n => { setAsignarEan(null); setAviso(`Sucursal asignada: ${n} orden(es) quedaron asociadas.`); cargar() }}
        />
      )}
    </div>
  )
}
