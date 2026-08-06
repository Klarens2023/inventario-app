'use client'
import { useState, useEffect } from 'react'
import type { PuntoVenta } from '@/types/usuarios'
import { type Modulo, type AreaInfo, modulosPorDefecto } from '@/lib/permissions'
import { labelStyle, inputStyle, btnPrimary, btnSecondary } from './constants'
import { ModulosChecklist } from './ModulosChecklist'

type Props = {
  esAdmin: boolean
  sesionArea: string
  areas: AreaInfo[]
  puntosVenta: PuntoVenta[]
  guardando: boolean
  error: string
  onClose: () => void
  onCrear: (body: Record<string, unknown>) => void
}

export function ModalCrear({ esAdmin, sesionArea, areas, puntosVenta, guardando, error, onClose, onCrear }: Props) {
  const areaInicial = esAdmin ? (areas.find(a => a.key !== 'puntos_venta')?.key ?? sesionArea) : sesionArea

  const [nombre, setNombre]       = useState('')
  const [username, setUsername]   = useState('')
  const [rol, setRol]             = useState('usuario')
  const [area, setArea]           = useState(areaInicial)
  const [puntoVenta, setPuntoVenta] = useState('')
  const [modulos, setModulos]     = useState<string[]>(() => modulosPorDefecto('usuario', areas.find(a => a.key === areaInicial)))
  const [accesoMovil, setAccesoMovil] = useState(rol !== 'lider')

  useEffect(() => {
    if (['pvn', 'pvv'].includes(rol)) setArea('puntos_venta')
    else if (area === 'puntos_venta') setArea(areaInicial)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol])

  useEffect(() => {
    setAccesoMovil(rol !== 'lider')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol])

  useEffect(() => {
    setModulos(modulosPorDefecto(rol, areas.find(a => a.key === area)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, area])

  function toggleModulo(m: Modulo) {
    setModulos(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function handleCrear() {
    const body: Record<string, unknown> = { nombre, username, rol, area: esAdmin ? area : sesionArea, acceso_movil: accesoMovil }
    if ((rol === 'pvn' || rol === 'pvv') && puntoVenta) body.punto_venta_id = parseInt(puntoVenta)
    if (!['pvn', 'pvv'].includes(rol)) body.modulos = modulos
    onCrear(body)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 4 }}>Nuevo Usuario</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Contraseña inicial: <strong>123456</strong>. El usuario deberá cambiarla al primer ingreso.
        </p>
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{error}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nombre completo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleCrear()} />
          </div>
          <div>
            <label style={labelStyle}>Nombre de usuario</label>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="Ej: jperez" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleCrear()} />
          </div>
          <div>
            <label style={labelStyle}>Rol</label>
            <select value={rol} onChange={e => setRol(e.target.value)} style={inputStyle}>
              <option value="usuario">Usuario</option>
              <option value="pvn">PVN (Punto de Venta)</option>
              <option value="pvv">PVV (Punto Principal — app móvil)</option>
              <option value="lider">Líder de Área</option>
              {esAdmin && <option value="admin">Administrador</option>}
            </select>
          </div>
          {esAdmin && (
            <div>
              <label style={labelStyle}>Área</label>
              {['pvn', 'pvv'].includes(rol) ? (
                <div style={{ ...inputStyle, background: '#f3e8ff', color: '#6b21a8', fontWeight: 600, border: '1px solid #d8b4fe' }}>
                  Puntos de Venta (asignada automáticamente)
                </div>
              ) : (
                <select value={area} onChange={e => setArea(e.target.value)} style={inputStyle}>
                  {areas.filter(a => a.key !== 'puntos_venta').map(a => (
                    <option key={a.key} value={a.key}>{a.label}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {(rol === 'pvn' || rol === 'pvv') && puntosVenta.length > 0 && (
            <div>
              <label style={labelStyle}>Punto de Venta {rol === 'pvv' ? '(dejar vacío si es rotatoria)' : ''}</label>
              <select value={puntoVenta} onChange={e => setPuntoVenta(e.target.value)} style={inputStyle}>
                <option value="">— Sin asignar —</option>
                {puntosVenta.filter(pv => pv.activo && pv.tipo === (rol === 'pvv' ? 'principal' : 'nacional')).map(pv => (
                  <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {!['pvn', 'pvv'].includes(rol) && (
            <ModulosChecklist seleccionados={modulos} onToggle={toggleModulo} />
          )}
          <div
            onClick={() => setAccesoMovil(v => !v)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${accesoMovil ? '#93c5fd' : '#e2e8f0'}`,
              background: accesoMovil ? '#eff6ff' : '#f8fafc',
            }}
          >
            <input type="checkbox" checked={accesoMovil} onChange={e => setAccesoMovil(e.target.checked)} style={{ marginTop: 2, cursor: 'pointer' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: accesoMovil ? '#1d4ed8' : '#1e293b' }}>Acceso a la app móvil</div>
              <div style={{ fontSize: 12, color: accesoMovil ? '#2563eb' : '#64748b', marginTop: 2 }}>
                Permite iniciar sesión en la app móvil (PVN/PVV), sin importar el rol.
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={handleCrear} disabled={guardando} style={{ ...btnPrimary, flex: 1, opacity: guardando ? 0.7 : 1 }}>
            {guardando ? 'Creando...' : 'Crear Usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
