'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { OrdenCen, EstadoOrdenCen, ResultadoSincronizacion } from '@/types/ordenes-cen'
import { COMPRADORES, nombreComprador } from '@/lib/cen/compradores'
import { DetalleOrdenModal } from '@/components/ordenes-cen/DetalleOrdenModal'
import { AsignarPuntoModal } from '@/components/ordenes-cen/AsignarPuntoModal'
import { TotalesRutaModal } from '@/components/ordenes-cen/TotalesRutaModal'
import { ESTADOS, fmtFecha, fmtMoneda, fmtNumero, relacion } from '@/components/ordenes-cen/utils'

type Resumen = { pendientes: number; sin_punto: number; enviadas: number; con_error: number; archivos_error: number }

type ResultadoEnvio = { id: number; oc: string; ok: boolean; mensaje: string }

// Solo se pueden enviar en lote las órdenes con sucursal asociada que aún no tienen pedido.
const enviable = (o: OrdenCen) => (o.estado === 'pendiente' || o.estado === 'error') && Boolean(o.nit)

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
  const [vista, setVista] = useState<'punto' | 'ruta'>('ruta')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set()) // las secciones arrancan recogidas
  const [rutas, setRutas] = useState<string[]>([])

  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [asignarEan, setAsignarEan] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [envio, setEnvio] = useState<{ total: number; resultados: ResultadoEnvio[]; enCurso: boolean } | null>(null)
  const [totales, setTotales] = useState<{ titulo: string; ruta: string | null; ids: number[] } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    const qs = new URLSearchParams({ estado, comprador, fuente, desde, hasta, buscar, ruta })
    try {
      const res = await fetch(`/api/logistica/ordenes-cen?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron cargar las órdenes')
      setOrdenes(data.ordenes); setResumen(data.resumen)
      // Quita de la selección lo que ya no está visible o ya no se puede enviar
      const visibles = new Set((data.ordenes as OrdenCen[]).filter(enviable).map(o => o.id))
      setSeleccion(prev => new Set(Array.from(prev).filter(id => visibles.has(id))))
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
    const m = new Map<string, { clave: string; titulo: string; subtitulo: string; sinPunto: boolean; ean: string; ruta: string | null; ordenes: OrdenCen[] }>()
    for (const o of ordenes) {
      let clave: string, titulo: string, subtitulo: string
      if (vista === 'ruta') {
        // Una sección por ruta; las relaciones (ruta + semana de entrega) se listan en el subtítulo.
        clave = o.ruta ?? 'sin-ruta'
        titulo = o.ruta ? `Ruta ${o.ruta}` : 'Sin ruta asignada'
        subtitulo = o.ruta ? '' : 'Asigna la ruta desde el detalle de cada orden o crea una regla'
      } else {
        clave = o.nit ? `${o.nit}/${o.sucursal}` : `ean:${o.ean_entrega}`
        titulo = o.razon_social ?? `Punto sin homologar · ${nombreComprador(o.ean_comprador)}`
        subtitulo = o.nit ? `NIT ${o.nit} · Sucursal ${o.sucursal} · ${o.ciudad ?? ''} · EAN ${o.ean_entrega}` : `EAN de entrega ${o.ean_entrega}`
      }
      if (!m.has(clave)) m.set(clave, { clave, titulo, subtitulo, sinPunto: vista === 'punto' ? !o.nit : !o.ruta, ean: o.ean_entrega, ruta: vista === 'ruta' ? o.ruta : null, ordenes: [] })
      m.get(clave)!.ordenes.push(o)
    }
    if (vista === 'ruta') {
      for (const g of Array.from(m.values())) {
        if (!g.ruta) continue
        const rels = Array.from(new Set(g.ordenes.map(o => relacion(o.ruta, o.fecha_entrega)).filter(Boolean))).sort()
        g.subtitulo = `${rels.length === 1 ? 'Relación' : 'Relaciones'} ${rels.join(', ')}`
      }
    }
    // Primero los que necesitan atención (sin punto / sin ruta)
    return Array.from(m.values()).sort((a, b) => Number(b.sinPunto) - Number(a.sinPunto) || a.titulo.localeCompare(b.titulo))
  }, [ordenes, vista])

  const marcar = (ids: number[], marcado: boolean) => setSeleccion(prev => {
    const n = new Set(prev); for (const id of ids) { if (marcado) n.add(id); else n.delete(id) } return n
  })

  // Envía a Siesa las órdenes seleccionadas, una por una (cada pedido se valida igual que en el detalle).
  async function enviarSeleccion() {
    const lista = ordenes.filter(o => seleccion.has(o.id))
    if (!lista.length) return
    if (!window.confirm(`Se crearán ${lista.length} pedido(s) en Siesa.\n\nLas alertas (precio, bodega por defecto, fecha vencida...) se darán por revisadas; las órdenes con bloqueos no se envían.\n\n¿Continuar?`)) return
    setEnvio({ total: lista.length, resultados: [], enCurso: true })
    for (const o of lista) {
      let r: ResultadoEnvio
      try {
        const res = await fetch(`/api/logistica/ordenes-cen/${o.id}/pedido`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmaAlertas: true }),
        })
        const data = await res.json()
        const bloqueos: string[] = (data.prep?.avisos ?? []).filter((a: { nivel: string }) => a.nivel === 'bloqueo').map((a: { mensaje: string }) => a.mensaje)
        r = { id: o.id, oc: o.numero_orden, ok: Boolean(data.ok), mensaje: [data.mensaje ?? data.error ?? 'Respuesta desconocida', ...(data.ok ? [] : bloqueos)].join(' · ') }
      } catch (e) {
        r = { id: o.id, oc: o.numero_orden, ok: false, mensaje: e instanceof Error ? e.message : 'Error de conexión' }
      }
      setEnvio(prev => prev && { ...prev, resultados: [...prev.resultados, r] })
    }
    setEnvio(prev => prev && { ...prev, enCurso: false })
    setSeleccion(new Set())
    await cargar()
  }

  const alternar = (clave: string) => setAbiertos(prev => {
    const n = new Set(prev); if (n.has(clave)) n.delete(clave); else n.add(clave); return n
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Órdenes EDI (CEN)</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>Órdenes de compra de las cadenas que llegan por Carvajal y Subrik, organizadas por ruta y punto de venta.</p>
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
                    {r.porRevisar.length > 0 && <span style={{ color: '#B45309', fontWeight: 600 }}> · ⚠ {r.porRevisar.length} quedaron por revisar (sin sucursal asociada): {r.porRevisar.join(', ')}</span>}
                    {r.errores.length > 0 && <span style={{ color: 'var(--danger)' }}> · {r.errores.length} archivo(s) con error: {r.errores.map(e => `${e.archivo} (${e.error})`).join('; ')}</span>}
                  </>}
            </div>
          ))}
        </div>
      )}
      {aviso && <div className="card" style={{ marginBottom: 16, color: 'var(--accent2)', fontSize: 13 }}>{aviso}</div>}
      {error && <div className="card" style={{ marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {resumen && resumen.sin_punto > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#F59E0B', background: '#FFFBEB', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, fontSize: 14, color: '#92400E' }}>
            <strong>⚠ {resumen.sin_punto} orden(es) por revisar.</strong> Su punto de entrega no está asociado a una sucursal de Siesa,
            así que no se puede crear el pedido. Asigna la sucursal (o descarta la orden si no aplica).
          </div>
          <button className="btn btn-primary" onClick={() => { setEstado('sin_punto'); setVista('punto') }}>Ver órdenes por revisar</button>
        </div>
      )}

      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          {([
            ['pendiente', 'Pendientes de pedido', resumen.pendientes],
            ['sin_punto', 'Por revisar', resumen.sin_punto],
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
          {(['ruta', 'punto'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '8px 12px', fontSize: 13, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: vista === v ? 'var(--accent)' : '#fff', color: vista === v ? '#fff' : 'var(--text)' }}>
              {v === 'punto' ? 'Por punto de venta' : 'Por ruta'}
            </button>
          ))}
        </div>
        {grupos.length > 0 && (
          <button className="btn" onClick={() => setAbiertos(abiertos.size > 0 ? new Set() : new Set(grupos.map(g => g.clave)))}>
            {abiertos.size > 0 ? 'Recoger todas' : 'Expandir todas'}
          </button>
        )}
      </div>

      {seleccion.size > 0 && (
        <div className="card" style={{ position: 'sticky', top: 8, zIndex: 5, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--accent)' }}>
          <strong style={{ fontSize: 14 }}>{seleccion.size} orden(es) seleccionada(s)</strong>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>
            {fmtNumero(ordenes.filter(o => seleccion.has(o.id)).reduce((s, o) => s + o.total_unidades, 0))} und ·{' '}
            {fmtMoneda(ordenes.filter(o => seleccion.has(o.id)).reduce((s, o) => s + o.valor_total, 0))}
          </span>
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setSeleccion(new Set())} disabled={envio?.enCurso}>Quitar selección</button>
          <button className="btn btn-primary" onClick={enviarSeleccion} disabled={envio?.enCurso}>
            {envio?.enCurso ? `Enviando ${envio.resultados.length + 1} de ${envio.total}...` : `Enviar ${seleccion.size} a Siesa`}
          </button>
        </div>
      )}
      {envio && (
        <div className="card" style={{ marginBottom: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong>
              {envio.enCurso ? `Enviando a Siesa: ${envio.resultados.length} de ${envio.total}` : `Envío terminado: ${envio.resultados.filter(r => r.ok).length} creado(s), ${envio.resultados.filter(r => !r.ok).length} con problema(s)`}
            </strong>
            {!envio.enCurso && <button className="btn" onClick={() => setEnvio(null)}>Cerrar</button>}
          </div>
          {envio.resultados.map(r => (
            <div key={r.id} style={{ color: r.ok ? '#047857' : 'var(--danger)', marginBottom: 2 }}>
              {r.ok ? '✓' : '✗'} OC {r.oc}: {r.mensaje}
            </div>
          ))}
        </div>
      )}

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
        const recogido = !abiertos.has(g.clave)
        const porRevisar = g.ordenes.filter(o => o.motivos.length > 0).length
        const idsEnviables = g.ordenes.filter(enviable).map(o => o.id)
        const marcadas = idsEnviables.filter(id => seleccion.has(id)).length
        return (
          <div key={g.clave} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden', borderColor: g.sinPunto ? '#F59E0B' : undefined }}>
            <div onClick={() => alternar(g.clave)} title={recogido ? 'Expandir' : 'Recoger'}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none', background: g.sinPunto ? '#FFFBEB' : 'var(--bg)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="checkbox" title={idsEnviables.length ? 'Seleccionar todas las órdenes de esta sección que se pueden enviar' : 'Ninguna orden de esta sección se puede enviar'}
                  disabled={!idsEnviables.length || envio?.enCurso} checked={idsEnviables.length > 0 && marcadas === idsEnviables.length}
                  ref={el => { if (el) el.indeterminate = marcadas > 0 && marcadas < idsEnviables.length }}
                  onClick={e => e.stopPropagation()} onChange={e => marcar(idsEnviables, e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: 'var(--text2)', display: 'inline-block', transition: 'transform .15s', transform: recogido ? 'rotate(-90deg)' : 'none' }}>▼</span>
                <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{g.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{g.subtitulo}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
                <span><strong>{g.ordenes.length}</strong> OC</span>
                {porRevisar > 0 && <span style={{ color: '#B45309', fontWeight: 700 }}>⚠ {porRevisar} por revisar</span>}
                <span><strong>{fmtNumero(unidades)}</strong> und</span>
                <span><strong>{pesoCompleto ? `${fmtNumero(peso, 1)} kg` : 'peso incompleto'}</strong></span>
                <span><strong>{fmtMoneda(valor)}</strong></span>
                <button className="btn" onClick={e => { e.stopPropagation(); setTotales({ titulo: vista === 'ruta' && g.ruta ? `${g.titulo} · ${g.subtitulo}` : g.titulo, ruta: g.ruta, ids: g.ordenes.map(o => o.id) }) }}>Totales</button>
                {g.sinPunto && vista === 'punto' && <button className="btn btn-primary" onClick={e => { e.stopPropagation(); setAsignarEan(g.ean) }}>Asignar sucursal</button>}
              </div>
            </div>
            {!recogido && <div style={{ overflowX: 'auto' }}>
              <table className="inv-table">
                <thead>
                  <tr><th style={{ width: 32 }}></th><th>OC</th><th>Cadena</th>{vista === 'ruta' && <th>Punto de venta</th>}<th>{vista === 'ruta' ? 'Relación' : 'Ruta'}</th><th>Fecha OC</th><th>Entrega</th><th>Productos</th><th>Unidades</th><th>Peso</th><th>Valor</th><th>Estado</th><th>Pedido Siesa</th></tr>
                </thead>
                <tbody>
                  {g.ordenes.map(o => (
                    <tr key={o.id} onClick={() => setDetalleId(o.id)} style={{ cursor: 'pointer', background: seleccion.has(o.id) ? '#EFF6FF' : undefined }}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" disabled={!enviable(o) || envio?.enCurso} checked={seleccion.has(o.id)}
                          title={enviable(o) ? 'Seleccionar para enviar a Siesa' : o.estado === 'enviado' ? 'Ya tiene pedido en Siesa' : !o.nit ? 'Sin sucursal asociada' : 'No se puede enviar'}
                          onChange={e => marcar([o.id], e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </td>
                      <td style={{ fontWeight: 700 }}>{o.numero_orden}</td>
                      <td>{nombreComprador(o.ean_comprador)}{o.locales > 0 && <span style={{ color: 'var(--text2)', fontSize: 12 }}> · CEDI, {o.locales} tiendas</span>}</td>
                      {vista === 'ruta' && <td>{o.razon_social ?? `EAN ${o.ean_entrega}`}{o.ciudad && <span style={{ color: 'var(--text2)', fontSize: 12 }}> · {o.ciudad}</span>}</td>}
                      <td>{o.ruta ? <strong>{vista === 'ruta' ? relacion(o.ruta, o.fecha_entrega) : o.ruta}{o.ruta_manual && <span title="Asignada a mano" style={{ color: 'var(--text2)' }}> ✋</span>}</strong> : <span style={{ color: '#B45309' }}>Sin ruta</span>}</td>
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
                        {o.motivos.length > 0 && (
                          <div style={{ fontSize: 11, color: '#B45309', marginTop: 4, maxWidth: 260 }}>⚠ {o.motivos.join(' · ')}</div>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: '#047857', whiteSpace: 'nowrap' }}>{o.siesa_consecutivo ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        )
      })}

      {totales && <TotalesRutaModal titulo={totales.titulo} ruta={totales.ruta} ids={totales.ids} onClose={() => setTotales(null)} />}
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
