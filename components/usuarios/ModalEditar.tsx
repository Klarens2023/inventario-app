'use client'
import { useState } from 'react'
import type { Usuario, PuntoVenta } from '@/types/usuarios'
import { type Modulo } from '@/lib/permissions'
import { labelStyle, inputStyle, btnPrimary, btnSecondary } from './constants'
import { ModulosChecklist } from './ModulosChecklist'

type Props = {
  usuario: Usuario
  esAdmin: boolean
  sessionUserId?: string
  puntosVenta: PuntoVenta[]
  editando: boolean
  onClose: () => void
  onGuardar: (id: number, body: Record<string, unknown>) => void
}

export function ModalEditar({ usuario, esAdmin, sessionUserId, puntosVenta, editando, onClose, onGuardar }: Props) {
  const esYo = String(usuario.id) === sessionUserId

  const [nombre, setNombre]           = useState(usuario.nombre)
  const [username, setUsername]       = useState(usuario.username)
  const [rol, setRol]                 = useState(usuario.rol)
  const [area, setArea]               = useState(['pvn', 'pvv'].includes(usuario.rol) ? 'puntos_venta' : usuario.area)
  const [puntoVenta, setPuntoVenta]   = useState(usuario.punto_venta_id ? String(usuario.punto_venta_id) : '')
  const [modulos, setModulos]         = useState<string[]>(usuario.modulos ?? [])
  const [resetPassword, setResetPassword] = useState(false)
  const [error, setError]             = useState('')

  function toggleModulo(m: Modulo) {
    setModulos(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function handleGuardar() {
    if (!nombre.trim() || !username.trim()) { setError('Nombre y usuario son obligatorios'); return }
    setError('')
    const body: Record<string, unknown> = { nombre, username }
    if (!esYo) body.rol = rol
    if (esAdmin && !esYo) body.area = area
    if (rol === 'pvn') body.punto_venta_id = puntoVenta ? parseInt(puntoVenta) : null
    if (!['pvn', 'pvv'].includes(rol)) body.modulos = modulos
    if (resetPassword) body.resetPassword = true
    onGuardar(usuario.id, body)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 4 }}>Editar Usuario</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Modifica los datos de <strong>{usuario.nombre}</strong>.
          {esYo && ' Es tu propia cuenta — no puedes cambiar tu rol ni área aquí.'}
        </p>
        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{error}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Nombre completo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Nombre de usuario</label>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} style={inputStyle} />
          </div>
          {esAdmin && !esYo && (
            <div>
              <label style={labelStyle}>Área</label>
              {['pvn', 'pvv'].includes(rol) ? (
                <div style={{ ...inputStyle, background: '#f3e8ff', color: '#6b21a8', fontWeight: 600, border: '1px solid #d8b4fe' }}>
                  Puntos de Venta (asignada automáticamente)
                </div>
              ) : (
                <select value={area} onChange={e => setArea(e.target.value)} style={inputStyle}>
                  <option value="logistica">Logística</option>
                  <option value="sistemas">Sistemas</option>
                  <option value="general">Administración (General)</option>
                </select>
              )}
            </div>
          )}
          {!esYo && (
            <div>
              <label style={labelStyle}>Rol</label>
              <select value={rol} onChange={e => {
                const r = e.target.value
                setRol(r)
                if (['pvn', 'pvv'].includes(r)) setArea('puntos_venta')
                else if (area === 'puntos_venta') setArea('logistica')
              }} style={inputStyle}>
                <option value="usuario">Usuario</option>
                <option value="pvn">PVN (Punto de Venta)</option>
                <option value="pvv">PVV (Punto Principal — app móvil)</option>
                <option value="lider">Líder de Área</option>
                {esAdmin && <option value="admin">Administrador</option>}
              </select>
            </div>
          )}
          {rol === 'pvn' && puntosVenta.length > 0 && (
            <div>
              <label style={labelStyle}>Punto de Venta</label>
              <select value={puntoVenta} onChange={e => setPuntoVenta(e.target.value)} style={inputStyle}>
                <option value="">— Sin asignar —</option>
                {puntosVenta.filter(pv => pv.activo).map(pv => (
                  <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {!['pvn', 'pvv'].includes(rol) && (
            <ModulosChecklist seleccionados={modulos} onToggle={toggleModulo} />
          )}
          <div
            onClick={() => setResetPassword(v => !v)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${resetPassword ? '#fca5a5' : '#e2e8f0'}`,
              background: resetPassword ? '#fee2e2' : '#f8fafc',
            }}
          >
            <input type="checkbox" checked={resetPassword} onChange={e => setResetPassword(e.target.checked)} style={{ marginTop: 2, cursor: 'pointer' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: resetPassword ? '#991b1b' : '#1e293b' }}>Restablecer contraseña</div>
              <div style={{ fontSize: 12, color: resetPassword ? '#b91c1c' : '#64748b', marginTop: 2 }}>
                Pone la contraseña genérica <strong>123456</strong> y el usuario deberá cambiarla al iniciar sesión.
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={handleGuardar} disabled={editando} style={{ ...btnPrimary, flex: 1, opacity: editando ? 0.7 : 1 }}>
            {editando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
