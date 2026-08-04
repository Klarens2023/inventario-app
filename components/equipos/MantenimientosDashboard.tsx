'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { EquipoMantenimiento } from '@/types/equipos'
import { fetchMantenimientos, registrarMantenimiento } from '@/lib/api/equipos'
import { fmtFecha, inputStyle } from './shared'
import { ModalRegistrarMantenimiento } from './ModalRegistrarMantenimiento'

type Filtro = 'todos' | 'vencidos' | 'proximos'

export function MantenimientosDashboard() {
  const [lista, setLista] = useState<EquipoMantenimiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [seleccionado, setSeleccionado] = useState<EquipoMantenimiento | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try { setLista(await fetchMantenimientos(buscar)) }
    finally { setCargando(false) }
  }, [buscar])

  useEffect(() => { cargar() }, [cargar])

  const hoy = new Date()
  const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)

  function estadoDe(eq: EquipoMantenimiento): 'vencido' | 'proximo' | 'al_dia' | 'sin_programar' {
    if (!eq.proximo_mantenimiento) return 'sin_programar'
    const prox = new Date(eq.proximo_mantenimiento)
    if (prox < hoy) return 'vencido'
    if (prox <= en30dias) return 'proximo'
    return 'al_dia'
  }

  const filtrada = lista.filter(eq => {
    if (filtro === 'todos') return true
    const e = estadoDe(eq)
    if (filtro === 'vencidos') return e === 'vencido'
    if (filtro === 'proximos') return e === 'proximo'
    return true
  })

  const vencidos = lista.filter(eq => estadoDe(eq) === 'vencido').length
  const proximos = lista.filter(eq => estadoDe(eq) === 'proximo').length

  async function guardar(data: { fecha: string; realizado: boolean; tecnico: string; proxima_fecha: string; observaciones: string }) {
    if (!seleccionado) return
    setGuardando(true)
    try {
      const res = await registrarMantenimiento({ equipo_id: seleccionado.id, ...data })
      if (res.error) { alert(res.error); return }
      setSeleccionado(null)
      cargar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <Link href="/sistemas/equipos" style={{ color: 'var(--text2)', textDecoration: 'none', fontSize: 14 }}>← Inventario de Equipos</Link>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '4px 0 4px' }}>Mantenimientos Preventivos</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>
        Klarens · Lácteos del Cesar SAS — {lista.length} equipos con mantenimiento programado
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setFiltro('todos')} style={filtroBtn(filtro === 'todos', '#0047BA')}>
          Todos ({lista.length})
        </button>
        <button onClick={() => setFiltro('vencidos')} style={filtroBtn(filtro === 'vencidos', '#dc2626')}>
          Vencidos ({vencidos})
        </button>
        <button onClick={() => setFiltro('proximos')} style={filtroBtn(filtro === 'proximos', '#d97706')}>
          Próximos 30 días ({proximos})
        </button>
      </div>

      <input value={buscar} onChange={e => setBuscar(e.target.value)}
        placeholder="Buscar por ID, marca, modelo, responsable..."
        style={{ ...inputStyle, marginBottom: 20, maxWidth: 420 }} />

      <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,71,186,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="inv-table">
            <thead>
              <tr>
                {['ID','Equipo','Ubicación / Responsable','Frecuencia','Técnico','Último Mant.','Próximo Mant.',''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando...</td></tr>}
              {!cargando && filtrada.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>No hay equipos en este filtro</td></tr>
              )}
              {!cargando && filtrada.map(eq => {
                const e = estadoDe(eq)
                return (
                  <tr key={eq.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{eq.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{eq.marca} {eq.modelo}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{eq.tipo_equipo}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {eq.sede && <div>{eq.sede}{eq.area_ubicacion ? ` · ${eq.area_ubicacion}` : ''}</div>}
                      {eq.responsable && <div style={{ color: 'var(--text2)' }}>{eq.responsable}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{eq.frecuencia_mantenimiento || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{eq.tecnico_responsable || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtFecha(eq.ultimo_mantenimiento)}</td>
                    <td style={{ fontSize: 12, fontWeight: e === 'vencido' ? 700 : 400, color: e === 'vencido' ? '#dc2626' : e === 'proximo' ? '#b45309' : 'var(--text2)' }}>
                      {fmtFecha(eq.proximo_mantenimiento)}
                      {e === 'vencido' && ' ⚠'}
                    </td>
                    <td>
                      <button onClick={() => setSeleccionado(eq)}
                        style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Registrar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {seleccionado && (
        <ModalRegistrarMantenimiento
          equipo={seleccionado}
          guardando={guardando}
          onClose={() => setSeleccionado(null)}
          onGuardar={guardar}
        />
      )}
    </div>
  )
}

function filtroBtn(activo: boolean, color: string): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 8, border: activo ? `2px solid ${color}` : '1px solid var(--border)',
    background: activo ? color : 'var(--bg2)', color: activo ? '#fff' : 'var(--text)',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  }
}
