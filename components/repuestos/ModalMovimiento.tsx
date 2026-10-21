'use client'
import { useEffect, useState } from 'react'
import type {
  Articulo, CamposMovimiento, EquipoOpcion, TipoMovArticulo, DestinoSalida,
  AsignadoPrevio, DecisionReemplazo, DestinoRetiro,
} from '@/types/repuestos'
import { registrarMovimiento, buscarEquipos, fetchAsignaciones } from '@/lib/api/repuestos'
import { inp, lbl, btnPrimary, btnSec } from '@/components/movimientos/styles'
import { AREAS } from '@/components/movimientos/constants'
import {
  MOTIVOS_POR_TIPO, MOTIVOS_SALIDA, TIPO_MOV_LABEL, TIPO_MOV_COLOR, DESTINO_SALIDA_LABEL, DESTINO_POR_CATEGORIA,
  MOTIVOS_REEMPLAZO, DESTINO_RETIRO_LABEL, unidadTexto, fmtFechaCorta,
} from './constants'
import { Campo, Modal } from './shared'
import { imprimirAsignacion, imprimirMovimiento } from './imprimir'

const MOTIVO_BAJA = 'Baja por daño / vencimiento'

type Props = {
  articulo: Articulo
  tipoInicial: TipoMovArticulo
  onClose: () => void
  onGuardado: () => void
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('en-CA')
}

function motivoInicial(tipo: TipoMovArticulo, destino: DestinoSalida) {
  return tipo === 'salida' ? MOTIVOS_SALIDA[destino][0] : MOTIVOS_POR_TIPO[tipo][0]
}

const DECISION_VACIA = { decision: '' as '' | 'reemplazo' | 'adicional', asignacion_id: 0, motivo: '', detalle: '', destino_retiro: '' as '' | DestinoRetiro }

export function ModalMovimiento({ articulo, tipoInicial, onClose, onGuardado }: Props) {
  const hoy = new Date().toLocaleDateString('en-CA')
  const destinoDefecto = DESTINO_POR_CATEGORIA[articulo.categoria]
  const [c, setC] = useState<CamposMovimiento>({
    tipo: tipoInicial, fecha: hoy, motivo: motivoInicial(tipoInicial, destinoDefecto),
    cantidad: tipoInicial === 'ajuste' ? String(articulo.stock_actual) : '1',
    destino: destinoDefecto, es_prestamo: false, fecha_limite_prestamo: sumarDias(hoy, 8),
    equipo_id: '', destino_nombre: '', destino_area: '', proveedor: '', documento_ref: '',
    costo_unitario: articulo.costo_unitario ? String(Number(articulo.costo_unitario)) : '', contador_paginas: '',
    observaciones: '',
  })
  // Resultado ya guardado: se muestra la confirmación con los formatos para imprimir
  const [hecho, setHecho] = useState<{ movId: number; asignacionId?: number; reemplazadaId?: number } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<EquipoOpcion[]>([])
  const [equipoSel, setEquipoSel] = useState<EquipoOpcion | null>(null)
  const [previos, setPrevios] = useState<AsignadoPrevio[]>([])
  const [revisando, setRevisando] = useState(false)
  const [dec, setDec] = useState(DECISION_VACIA)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof CamposMovimiento>(k: K, v: CamposMovimiento[K]) => setC(prev => ({ ...prev, [k]: v }))

  function cambiarTipo(t: TipoMovArticulo) {
    setError('')
    setC(prev => ({
      ...prev, tipo: t, motivo: motivoInicial(t, prev.destino),
      cantidad: t === 'ajuste' ? String(articulo.stock_actual) : '1',
    }))
  }

  function cambiarDestino(d: DestinoSalida) {
    setError('')
    setC(prev => ({
      ...prev, destino: d, motivo: MOTIVOS_SALIDA[d][0],
      // Entregar a alguien sin equipo normalmente es un préstamo; se puede desmarcar
      es_prestamo: d === 'persona' ? true : d === 'consumo' ? false : prev.es_prestamo,
    }))
    if (d === 'persona') quitarEquipo()
  }

  // Buscador de equipos con espera corta para no consultar en cada tecla
  useEffect(() => {
    if (equipoSel || busqueda.trim().length < 2) { setResultados([]); return }
    const t = setTimeout(() => { buscarEquipos(busqueda).then(setResultados) }, 300)
    return () => clearTimeout(t)
  }, [busqueda, equipoSel])

  // Al elegir equipo para asignar: ¿ya tiene algo del mismo tipo?
  useEffect(() => {
    setPrevios([]); setDec(DECISION_VACIA)
    if (!equipoSel || c.tipo !== 'salida' || c.destino !== 'equipo') return
    setRevisando(true)
    fetchAsignaciones({ estado: 'vigente', equipo_id: equipoSel.id })
      .then(lista => {
        const mismos = lista
          .filter(a => a.tipo === articulo.tipo && a.categoria === articulo.categoria)
          .map(a => ({ id: a.id, articulo_codigo: a.articulo_codigo, descripcion: a.descripcion, cantidad: a.cantidad,
                       fecha_asignacion: a.fecha_asignacion, persona_nombre: a.persona_nombre, es_prestamo: a.es_prestamo }))
        setPrevios(mismos)
        if (mismos.length === 1) setDec(d => ({ ...d, asignacion_id: mismos[0].id }))
      })
      .finally(() => setRevisando(false))
  }, [equipoSel, c.tipo, c.destino, articulo.tipo, articulo.categoria])

  function elegirEquipo(e: EquipoOpcion) {
    setEquipoSel(e)
    setResultados([])
    setC(prev => ({
      ...prev, equipo_id: e.id,
      destino_nombre: prev.destino_nombre || e.usuario_asignado || '',
      destino_area: prev.destino_area || e.area_ubicacion || '',
    }))
  }

  function quitarEquipo() {
    setEquipoSel(null)
    setBusqueda('')
    setC(prev => ({ ...prev, equipo_id: '' }))
  }

  const n = parseInt(c.cantidad, 10)
  const cantidadValida = Number.isInteger(n) && n >= 0 && (c.tipo === 'ajuste' || n > 0)
  const nuevoStock = !cantidadValida ? null
    : c.tipo === 'entrada' ? articulo.stock_actual + n
    : c.tipo === 'salida'  ? articulo.stock_actual - n
    : n
  const sinStock = c.tipo === 'salida' && nuevoStock !== null && nuevoStock < 0
  const asigna = c.tipo === 'salida' && c.destino !== 'consumo'
  const anterior = previos.find(p => p.id === dec.asignacion_id)

  function validar(): string {
    if (!cantidadValida) return c.tipo === 'ajuste' ? 'Indica el stock contado (0 o más)' : 'La cantidad debe ser mayor que cero'
    if (sinStock) return `Solo hay ${articulo.stock_actual} en stock`
    if (c.tipo !== 'salida') return ''
    if (c.destino === 'equipo' && !c.equipo_id) return 'Selecciona el equipo al que se asigna'
    if (c.destino === 'consumo' && !c.equipo_id && c.motivo !== MOTIVO_BAJA) return 'Selecciona el equipo donde se consume (para el análisis de gasto)'
    if (c.destino === 'persona') {
      if (!c.destino_nombre.trim()) return 'Indica el nombre de quien recibe'
      if (!c.observaciones.trim()) return 'Escribe en observaciones para qué se entrega (es obligatorio sin equipo)'
    }
    if (asigna && c.es_prestamo && (!c.fecha_limite_prestamo || c.fecha_limite_prestamo < c.fecha)) {
      return 'Indica hasta cuándo es el préstamo (igual o posterior a la fecha de entrega)'
    }
    if (previos.length > 0) {
      if (!dec.decision) return 'Indica si es un reemplazo o una asignación adicional'
      if (dec.decision === 'reemplazo') {
        if (!dec.asignacion_id) return 'Selecciona cuál se reemplaza'
        if (!dec.motivo) return 'Indica el motivo del reemplazo'
        if (!dec.destino_retiro) return 'Indica qué pasa con el anterior'
      }
    }
    return ''
  }

  async function guardar() {
    const msg = validar()
    setError(msg)
    if (msg) return
    setGuardando(true)
    try {
      const reemplazo: DecisionReemplazo | undefined = !dec.decision ? undefined
        : dec.decision === 'adicional' ? { decision: 'adicional' }
        : { decision: 'reemplazo', asignacion_id: dec.asignacion_id, motivo: dec.motivo,
            detalle: dec.detalle, destino_retiro: dec.destino_retiro as DestinoRetiro }
      const res = await registrarMovimiento({ ...c, articulo_codigo: articulo.codigo, reemplazo })
      if (res.requiere_decision && res.vigentes) {
        // Alguien más le asignó algo al equipo mientras se llenaba el formulario
        setPrevios(res.vigentes)
        setDec({ ...DECISION_VACIA, asignacion_id: res.vigentes.length === 1 ? res.vigentes[0].id : 0 })
      }
      if (res.error) { setError(res.error); return }
      setHecho({
        movId: res.id as number, asignacionId: res.asignacion_id,
        reemplazadaId: dec.decision === 'reemplazo' ? dec.asignacion_id : undefined,
      })
    } finally {
      setGuardando(false)
    }
  }

  const opcion = (activo: boolean, color = '#0047BA', bg = '#eff6ff') => ({
    flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, textAlign: 'left' as const,
    border: activo ? `2px solid ${color}` : '1px solid #e2e8f0', background: activo ? bg : '#fff', color: activo ? color : '#475569',
  })

  const esImpresora = /impresora|plotter|multifuncional/i.test(equipoSel?.tipo_equipo ?? '') || articulo.categoria === 'Insumo'

  if (hecho) {
    const btnImp = { ...btnSec, display: 'block', width: '100%', textAlign: 'left' as const, marginBottom: 8 }
    return (
      <Modal titulo="Movimiento registrado" subtitulo={`${articulo.codigo} — ${articulo.descripcion}`} onClose={onGuardado} ancho={460}>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: '#d1fae5', color: '#065f46', fontSize: 13, marginBottom: 16 }}>
          ✓ Quedó registrado {hecho.asignacionId ? `como asignación ASG-${String(hecho.asignacionId).padStart(6, '0')}` : `como MOV-${String(hecho.movId).padStart(6, '0')}`}.
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>Formatos para imprimir y firmar</div>
        {hecho.asignacionId ? (
          <button style={btnImp} onClick={() => imprimirAsignacion(hecho.asignacionId!, 'entrega')}>🖨️ Acta de entrega{hecho.reemplazadaId ? ' (incluye el reemplazo)' : ''}</button>
        ) : (
          <button style={btnImp} onClick={() => imprimirMovimiento(hecho.movId)}>🖨️ Comprobante de {c.tipo === 'salida' ? 'consumo' : c.tipo}</button>
        )}
        {hecho.reemplazadaId && (
          <button style={btnImp} onClick={() => imprimirAsignacion(hecho.reemplazadaId!, 'retiro')}>🖨️ Acta de retiro del artículo reemplazado</button>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onGuardado} style={btnPrimary}>Cerrar</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titulo="Registrar movimiento" subtitulo={`${articulo.codigo} — ${articulo.descripcion}`} onClose={onClose} ancho={620}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['entrada', 'salida', 'ajuste'] as TipoMovArticulo[]).map(t => {
          const activo = c.tipo === t
          const col = TIPO_MOV_COLOR[t]
          return (
            <button key={t} type="button" onClick={() => cambiarTipo(t)} style={{
              flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: activo ? `2px solid ${col.color}` : '1px solid #e2e8f0',
              background: activo ? col.bg : '#fff', color: activo ? col.color : '#475569',
            }}>
              {TIPO_MOV_LABEL[t]}
            </button>
          )
        })}
      </div>

      {c.tipo === 'salida' && (
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>¿A dónde va?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['equipo', 'persona', 'consumo'] as DestinoSalida[]).map(d => (
              <button key={d} type="button" onClick={() => cambiarDestino(d)} style={opcion(c.destino === d)}>
                {DESTINO_SALIDA_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Campo label={asigna ? 'Fecha de entrega *' : 'Fecha *'}>
          <input type="date" value={c.fecha} onChange={e => set('fecha', e.target.value)} style={inp} />
        </Campo>
        <Campo label="Motivo *">
          <select value={c.motivo} onChange={e => set('motivo', e.target.value)} style={inp}>
            {(c.tipo === 'salida' ? MOTIVOS_SALIDA[c.destino] : MOTIVOS_POR_TIPO[c.tipo]).map(m => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label={c.tipo === 'ajuste' ? 'Stock contado *' : 'Cantidad *'}>
          <input type="number" min={0} value={c.cantidad} onChange={e => set('cantidad', e.target.value)} style={inp} />
        </Campo>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 13, color: '#475569', paddingBottom: 9 }}>
            Stock: <b>{articulo.stock_actual}</b> →{' '}
            <b style={{ color: sinStock ? '#dc2626' : '#0047BA' }}>{nuevoStock ?? '—'}</b> {unidadTexto(articulo.unidad, nuevoStock ?? 0)}
          </div>
        </div>

        {c.tipo === 'salida' && c.destino !== 'persona' && (
          <Campo label={c.destino === 'equipo' ? 'Equipo *' : c.motivo === MOTIVO_BAJA ? 'Equipo (opcional)' : 'Equipo donde se consume *'} span={2}>
            {equipoSel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 8, fontSize: 13 }}>
                <b style={{ color: '#0047BA', fontFamily: 'monospace' }}>{equipoSel.id}</b>
                <span style={{ flex: 1, color: '#334155' }}>{equipoSel.tipo_equipo} {equipoSel.marca} {equipoSel.modelo}{equipoSel.usuario_asignado ? ` · ${equipoSel.usuario_asignado}` : ''}</span>
                <button type="button" onClick={quitarEquipo} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }} title="Quitar">×</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} style={inp}
                  placeholder="Buscar por código KL, serial, placa o usuario" />
                {resultados.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 220, overflowY: 'auto' }}>
                    {resultados.map(r => (
                      <div key={r.id} onClick={() => elegirEquipo(r)}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                        style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}>
                        <b style={{ color: '#0047BA', fontFamily: 'monospace' }}>{r.id}</b>{' '}
                        {r.tipo_equipo} {r.marca} {r.modelo}
                        {r.usuario_asignado && <span style={{ color: '#94a3b8' }}> · {r.usuario_asignado}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {revisando && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Revisando lo que ya tiene asignado el equipo...</div>}
          </Campo>
        )}

        {/* El equipo ya tiene algo del mismo tipo: ¿reemplazo o adicional? */}
        {asigna && previos.length > 0 && (
          <div style={{ gridColumn: 'span 2', border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: 13, marginBottom: 8 }}>
              ⚠ Este equipo ya tiene asignado {previos.length === 1 ? 'un' : `${previos.length}`} {articulo.tipo.toLowerCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {previos.map(p => (
                <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#334155', cursor: dec.decision === 'reemplazo' ? 'pointer' : 'default' }}>
                  {dec.decision === 'reemplazo' && previos.length > 1 && (
                    <input type="radio" checked={dec.asignacion_id === p.id} onChange={() => setDec(d => ({ ...d, asignacion_id: p.id }))} />
                  )}
                  <span><b style={{ fontFamily: 'monospace', color: '#0047BA' }}>{p.articulo_codigo}</b> {p.descripcion}
                    {p.cantidad > 1 ? ` (×${p.cantidad})` : ''} — desde {fmtFechaCorta(p.fecha_asignacion)}
                    {p.es_prestamo ? ' · préstamo' : ''}{p.persona_nombre ? ` · ${p.persona_nombre}` : ''}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={opcion(dec.decision === 'reemplazo', '#92400e', '#fef3c7')}
                onClick={() => setDec(d => ({ ...d, decision: 'reemplazo', asignacion_id: d.asignacion_id || (previos.length === 1 ? previos[0].id : 0) }))}>
                Sí, es un reemplazo
              </button>
              <button type="button" style={opcion(dec.decision === 'adicional', '#065f46', '#d1fae5')}
                onClick={() => setDec(d => ({ ...d, decision: 'adicional' }))}>
                No, es adicional
              </button>
            </div>

            {dec.decision === 'reemplazo' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
                <Campo label="Motivo del reemplazo *">
                  <select value={dec.motivo} onChange={e => setDec(d => ({ ...d, motivo: e.target.value }))} style={inp}>
                    <option value="">Seleccionar...</option>
                    {MOTIVOS_REEMPLAZO.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Campo>
                <div />
                <Campo label="Detalle del motivo" span={2}>
                  <input value={dec.detalle} onChange={e => setDec(d => ({ ...d, detalle: e.target.value }))} style={inp}
                    placeholder="Ej: el clic izquierdo no responde; cable roto" />
                </Campo>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={lbl}>¿Qué pasa con el anterior{anterior ? ` (${anterior.articulo_codigo})` : ''}? *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {(Object.keys(DESTINO_RETIRO_LABEL) as DestinoRetiro[]).map(k => (
                      <button key={k} type="button" onClick={() => setDec(d => ({ ...d, destino_retiro: k }))}
                        style={opcion(dec.destino_retiro === k)}>
                        {DESTINO_RETIRO_LABEL[k]}
                      </button>
                    ))}
                  </div>
                  {dec.destino_retiro === 'inventario' && anterior && (
                    <div style={{ fontSize: 12, color: '#065f46', marginTop: 6 }}>
                      Se sumará {anterior.cantidad} al stock de {anterior.articulo_codigo} con una entrada en el kardex.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {c.tipo === 'salida' && c.destino !== 'consumo' && (
          <>
            <Campo label={c.destino === 'persona' ? 'Entregado a *' : 'Usuario del equipo'}>
              <input value={c.destino_nombre} onChange={e => set('destino_nombre', e.target.value)} style={inp} placeholder="Nombre de quien recibe" />
            </Campo>
            <Campo label="Área">
              <input list="areas-repuestos" value={c.destino_area} onChange={e => set('destino_area', e.target.value)} style={inp} />
              <datalist id="areas-repuestos">{AREAS.map(a => <option key={a} value={a} />)}</datalist>
            </Campo>
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155', fontWeight: 600 }}>
                <input type="checkbox" checked={c.es_prestamo} onChange={e => set('es_prestamo', e.target.checked)} />
                Es préstamo (debe devolverse)
              </label>
              {c.es_prestamo && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155' }}>
                  Devolver a más tardar el
                  <input type="date" value={c.fecha_limite_prestamo} min={c.fecha}
                    onChange={e => set('fecha_limite_prestamo', e.target.value)} style={{ ...inp, width: 160 }} />
                </label>
              )}
            </div>
          </>
        )}

        {c.tipo === 'salida' && c.destino === 'consumo' && esImpresora && c.motivo !== MOTIVO_BAJA && (
          <Campo label="Contador de páginas de la impresora (lectura actual)" span={2}>
            <input type="number" min={0} value={c.contador_paginas} onChange={e => set('contador_paginas', e.target.value)} style={inp}
              placeholder="Opcional. Con esta lectura se calcula cuántas páginas rinde cada tóner y el costo por página" />
          </Campo>
        )}

        {c.tipo === 'entrada' && (
          <>
            <Campo label="Proveedor">
              <input value={c.proveedor} onChange={e => set('proveedor', e.target.value)} style={inp} />
            </Campo>
            <Campo label="Factura / documento">
              <input value={c.documento_ref} onChange={e => set('documento_ref', e.target.value)} style={inp} placeholder="Ej: FE-12345, OC-778" />
            </Campo>
            <Campo label="Costo unitario (COP)">
              <input type="number" min={0} value={c.costo_unitario} onChange={e => set('costo_unitario', e.target.value)} style={inp} />
            </Campo>
            <div style={{ fontSize: 12, color: '#64748b', alignSelf: 'end', paddingBottom: 9 }}>
              Se toma como costo del artículo para valorar las salidas siguientes.
            </div>
          </>
        )}

        <Campo label={c.tipo === 'salida' && c.destino === 'persona' ? 'Observaciones * (para qué se entrega, condiciones)' : 'Observaciones'} span={2}>
          <textarea value={c.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }}
            placeholder={c.tipo === 'salida' && c.destino === 'persona' ? 'Ej: diadema para capacitación virtual; se entrega en buen estado con cable' : ''} />
        </Campo>
      </div>

      {error && <div style={{ marginTop: 14, padding: '9px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={guardar} disabled={guardando || sinStock || revisando} style={{ ...btnPrimary, opacity: (guardando || sinStock || revisando) ? 0.6 : 1 }}>
          {guardando ? 'Guardando...'
            : dec.decision === 'reemplazo' ? 'Registrar reemplazo'
            : asigna ? 'Registrar asignación'
            : `Registrar ${TIPO_MOV_LABEL[c.tipo].toLowerCase()}`}
        </button>
      </div>
    </Modal>
  )
}
