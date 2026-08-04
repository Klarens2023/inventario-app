'use client'
import { useState, useRef } from 'react'
import type { FilaActivo, EquipoBusqueda } from '@/types/movimientos'
import { crearMovimiento } from '@/lib/api/movimientos'
import { TIPOS_MOV, MOTIVOS, AREAS, TIPOS_ACTIVO, FILA_VACIA } from './constants'
import { FormSection } from './shared'
import { inp, lbl, btnPrimary, btnSec } from './styles'

function hoy() { return new Date().toISOString().slice(0, 10) }

type Props = {
  proximoId: string
  equipoInicial?: EquipoBusqueda | null
  onCancelar: () => void
  onGuardado: () => void
}

function filaDesdeEquipo(eq: EquipoBusqueda): FilaActivo {
  return {
    equipo_id: eq.id,
    descripcion: `${eq.marca} ${eq.modelo}`.trim(),
    tipo_activo: eq.tipo_equipo,
    cantidad: 1,
    _busqueda: eq.id,
    _resultados: [],
    _buscando: false,
  }
}

export function MovimientoForm({ proximoId, equipoInicial, onCancelar, onGuardado }: Props) {
  const [fecha,         setFecha]         = useState(hoy())
  const [movimiento,    setMovimiento]    = useState('definitivo')
  const [tipoMov,       setTipoMov]       = useState('')
  const [motivo,        setMotivo]        = useState('')
  const [origenNombre,  setOrigenNombre]  = useState('')
  const [origenDoc,     setOrigenDoc]     = useState('')
  const [origenArea,    setOrigenArea]    = useState('')
  const [destinoNombre, setDestinoNombre] = useState('')
  const [destinoDoc,    setDestinoDoc]    = useState('')
  const [destinoArea,   setDestinoArea]   = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [activos,       setActivos]       = useState<FilaActivo[]>(equipoInicial ? [filaDesdeEquipo(equipoInicial)] : [FILA_VACIA()])
  const [guardando,     setGuardando]     = useState(false)
  const [errorForm,     setErrorForm]     = useState('')
  const [exitoForm,     setExitoForm]     = useState('')
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // ── Autocomplete equipos ───────────────────────────────────────────────────
  function onBusquedaEquipo(idx: number, val: string) {
    setActivos(prev => prev.map((f, i) => i === idx ? { ...f, _busqueda: val, equipo_id: val } : f))
    if (debounceRefs.current[idx]) clearTimeout(debounceRefs.current[idx])
    if (val.length < 2) {
      setActivos(prev => prev.map((f, i) => i === idx ? { ...f, _resultados: [] } : f))
      return
    }
    debounceRefs.current[idx] = setTimeout(async () => {
      setActivos(prev => prev.map((f, i) => i === idx ? { ...f, _buscando: true } : f))
      const res = await fetch(`/api/sistemas/equipos?buscar=${encodeURIComponent(val)}`).then(r => r.json())
      setActivos(prev => prev.map((f, i) =>
        i === idx ? { ...f, _buscando: false, _resultados: Array.isArray(res) ? res.slice(0, 6) : [] } : f
      ))
    }, 300)
  }

  function seleccionarEquipo(idx: number, eq: EquipoBusqueda) {
    setActivos(prev => prev.map((f, i) => i === idx ? {
      ...f,
      equipo_id:   eq.id,
      descripcion: `${eq.marca} ${eq.modelo}`.trim(),
      tipo_activo: eq.tipo_equipo,
      _busqueda:   eq.id,
      _resultados: [],
    } : f))
  }

  function actualizarFila(idx: number, campo: keyof FilaActivo, val: string | number) {
    setActivos(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: val } : f))
  }

  function agregarFila()        { setActivos(prev => [...prev, FILA_VACIA()]) }
  function quitarFila(idx: number) {
    setActivos(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  async function guardar() {
    setErrorForm('')
    if (!tipoMov || !motivo)                         { setErrorForm('Selecciona tipo de movimiento y motivo'); return }
    if (!origenNombre || !origenDoc || !origenArea)  { setErrorForm('Completa los datos de origen'); return }
    if (!destinoNombre || !destinoDoc || !destinoArea) { setErrorForm('Completa los datos de destino'); return }
    if (activos.some(a => !a.equipo_id))             { setErrorForm('Selecciona la placa de todos los activos'); return }

    setGuardando(true)
    try {
      const data = await crearMovimiento({
        fecha, movimiento, tipo_movimiento: tipoMov, motivo,
        origen_nombre: origenNombre, origen_documento: origenDoc, origen_area: origenArea,
        destino_nombre: destinoNombre, destino_documento: destinoDoc, destino_area: destinoArea,
        observaciones: observaciones || null,
        activos: activos.map(a => ({
          equipo_id: a.equipo_id, descripcion: a.descripcion,
          tipo_activo: a.tipo_activo, cantidad: a.cantidad,
        })),
      })
      if (data.error) { setErrorForm(data.error); return }
      setExitoForm(`Movimiento ${data.id} registrado correctamente`)
      setTimeout(onGuardado, 1500)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button onClick={onCancelar} style={btnSec}>← Volver</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>Nuevo Movimiento</h1>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Consecutivo: <b style={{ color: '#0047BA' }}>{proximoId}</b>
            {equipoInicial && <span> · Prellenado desde equipo <b style={{ color: '#0047BA', fontFamily: 'monospace' }}>{equipoInicial.id}</b></span>}
          </div>
        </div>
      </div>

      {errorForm && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>
          {errorForm}
        </div>
      )}
      {exitoForm && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#065f46', fontWeight: 600 }}>
          {exitoForm}
        </div>
      )}

      {/* Encabezado */}
      <FormSection title="Encabezado">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Definitivo / Temporal *</label>
            <select value={movimiento} onChange={e => setMovimiento(e.target.value)} style={inp}>
              <option value="definitivo">Definitivo</option>
              <option value="temporal">Temporal (requiere devolución)</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Tipo de movimiento *</label>
            <select value={tipoMov} onChange={e => setTipoMov(e.target.value)} style={inp}>
              <option value="">— Selecciona —</option>
              {TIPOS_MOV.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Motivo *</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)} style={inp}>
              <option value="">— Selecciona —</option>
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </FormSection>

      {/* Origen / Destino */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <FormSection title="Origen (Entrega)">
          <label style={lbl}>Nombre *</label>
          <input value={origenNombre} onChange={e => setOrigenNombre(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Nombre completo" />
          <label style={lbl}>No. de Documento *</label>
          <input value={origenDoc} onChange={e => setOrigenDoc(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Cédula" />
          <label style={lbl}>Área / Dependencia *</label>
          <select value={origenArea} onChange={e => setOrigenArea(e.target.value)} style={inp}>
            <option value="">— Selecciona —</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </FormSection>
        <FormSection title="Destino (Recibe)">
          <label style={lbl}>Nombre *</label>
          <input value={destinoNombre} onChange={e => setDestinoNombre(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Nombre completo" />
          <label style={lbl}>No. de Documento *</label>
          <input value={destinoDoc} onChange={e => setDestinoDoc(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Cédula" />
          <label style={lbl}>Área / Dependencia *</label>
          <select value={destinoArea} onChange={e => setDestinoArea(e.target.value)} style={inp}>
            <option value="">— Selecciona —</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </FormSection>
      </div>

      {/* Activos */}
      <FormSection title="Activos del movimiento">
        {activos.map((fila, idx) => (
          <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: '#fafafa' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 80px 32px', gap: 10, alignItems: 'start' }}>

              {/* Autocomplete placa */}
              <div style={{ position: 'relative' }}>
                <label style={lbl}>Placa (KL-XXXX) *</label>
                <input
                  value={fila._busqueda}
                  onChange={e => onBusquedaEquipo(idx, e.target.value)}
                  placeholder="KL-0001"
                  style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }}
                  autoComplete="off"
                />
                {(fila._resultados.length > 0 || fila._buscando) && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 2 }}>
                    {fila._buscando && <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>Buscando...</div>}
                    {fila._resultados.map(eq => (
                      <div key={eq.id}
                        onClick={() => seleccionarEquipo(idx, eq)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <b style={{ color: '#0047BA', fontFamily: 'monospace' }}>{eq.id}</b>
                        <span style={{ color: '#334155', marginLeft: 8 }}>{eq.marca} {eq.modelo}</span>
                        {eq.usuario_asignado && <span style={{ color: '#94a3b8', marginLeft: 6 }}>· {eq.usuario_asignado}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={lbl}>Descripción</label>
                <input value={fila.descripcion} onChange={e => actualizarFila(idx, 'descripcion', e.target.value)} style={inp} placeholder="Descripción del activo" />
              </div>
              <div>
                <label style={lbl}>Tipo de activo</label>
                <select value={fila.tipo_activo} onChange={e => actualizarFila(idx, 'tipo_activo', e.target.value)} style={inp}>
                  <option value="">— Tipo —</option>
                  {TIPOS_ACTIVO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cant.</label>
                <input type="number" min={1} value={fila.cantidad}
                  onChange={e => actualizarFila(idx, 'cantidad', parseInt(e.target.value) || 1)}
                  style={{ ...inp, textAlign: 'center' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
                <button onClick={() => quitarFila(idx)} title="Quitar"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1, padding: '6px 2px' }}>
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={agregarFila} style={{ ...btnSec, fontSize: 13, marginTop: 4 }}>+ Agregar equipo</button>
      </FormSection>

      {/* Observaciones */}
      <FormSection title="Observaciones">
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
          rows={3} placeholder="Notas adicionales..."
          style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
      </FormSection>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onCancelar} style={btnSec}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={{ ...btnPrimary, opacity: guardando ? 0.7 : 1 }}>
          {guardando ? 'Guardando...' : 'Registrar movimiento'}
        </button>
      </div>
    </div>
  )
}
