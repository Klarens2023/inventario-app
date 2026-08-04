'use client'
import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Equipo, FiltrosEquipos } from '@/types/equipos'
import { TIPOS_EQUIPO, ESTADOS_EQUIPO, ESTADOS_COLOR } from './constants'
import { inputStyle, selectStyle } from './shared'

type Props = {
  lista: Equipo[]
  cargando: boolean
  filtros: FiltrosEquipos
  canCreate: boolean
  onFiltro: (f: Partial<FiltrosEquipos>) => void
  onBuscar: () => void
}

export function EquiposList({ lista, cargando, filtros, canCreate, onFiltro, onBuscar }: Props) {
  const router = useRouter()
  const hoy = new Date()

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Inventario de Equipos TI</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>
            Klarens · Lácteos del Cesar SAS — {lista.length} equipos registrados
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/sistemas/mantenimientos" style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
            fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6
          }}>🛠 Mantenimientos</Link>
          {canCreate && (
            <Link href="/sistemas/equipos/nuevo" style={{
              padding: '10px 20px', borderRadius: 8, background: '#0047BA', color: '#fff',
              fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6
            }}>+ Nuevo Equipo</Link>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input value={filtros.buscar} onChange={e => onFiltro({ buscar: e.target.value })}
          placeholder="Buscar por ID, marca, modelo, serie, usuario..."
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          onKeyDown={e => e.key === 'Enter' && onBuscar()} />
        <select value={filtros.tipo} onChange={e => onFiltro({ tipo: e.target.value })}
          style={{ ...selectStyle, flexShrink: 0, width: 180 }}>
          <option value="">Todos los tipos</option>
          {TIPOS_EQUIPO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filtros.estado} onChange={e => onFiltro({ estado: e.target.value })}
          style={{ ...selectStyle, flexShrink: 0, width: 180 }}>
          <option value="">Todos los estados</option>
          {ESTADOS_EQUIPO.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,71,186,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="inv-table">
            <thead>
              <tr>
                {['ID','Tipo','Marca / Modelo','N° Serie','Ubicación','Asignado a','Estado','Próx. Mant.',''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Cargando...</td></tr>
              )}
              {!cargando && lista.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>No se encontraron equipos</td></tr>
              )}
              {!cargando && lista.map(eq => {
                const s = ESTADOS_COLOR[eq.estado] ?? { color: '#374151', bg: '#f3f4f6' }
                const proxMant = eq.proximo_mantenimiento ? new Date(eq.proximo_mantenimiento) : null
                const mantVencido = proxMant && proxMant < hoy
                return (
                  <tr key={eq.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/sistemas/equipos/${eq.id}`)}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{eq.id}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{eq.tipo_equipo}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{eq.marca}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{eq.modelo}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{eq.numero_serie || '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {eq.sede && <div>{eq.sede}</div>}
                      {eq.area_ubicacion && <div style={{ color: 'var(--text2)' }}>{eq.area_ubicacion}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{eq.usuario_asignado || eq.responsable || '—'}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg }}>
                        {eq.estado}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: mantVencido ? '#dc2626' : 'var(--text2)', fontWeight: mantVencido ? 700 : 400 }}>
                      {proxMant ? proxMant.toLocaleDateString('es-CO') : '—'}
                    </td>
                    <td>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const params = new URLSearchParams({
                            equipo_id: eq.id, tipo_equipo: eq.tipo_equipo ?? '',
                            marca: eq.marca ?? '', modelo: eq.modelo ?? '', numero_serie: eq.numero_serie ?? '',
                          })
                          router.push(`/sistemas/movimientos?${params}`)
                        }}
                        title="Hacer movimiento de este equipo"
                        style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        🔀 Movimiento
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
