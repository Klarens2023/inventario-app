'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { GRUPOS_MODULOS, MODULO_LABELS, modulosPorDefecto, type Modulo } from '@/lib/permissions'

type Usuario = {
  id: number
  username: string
  nombre: string
  rol: string
  area: string
  activo: boolean
  debe_cambiar_password: boolean
  created_at: string
  punto_venta_id?: number | null
  punto_venta_nombre?: string | null
  modulos?: string[]
}

type PuntoVenta = { id: number; nombre: string; activo: boolean }

const ROL_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  admin:   { label: 'Admin',   color: '#1d4ed8', bg: '#dbeafe' },
  lider:   { label: 'Líder',   color: '#7c3aed', bg: '#ede9fe' },
  usuario: { label: 'Usuario', color: '#374151', bg: '#f3f4f6' },
  pvn:     { label: 'PVN',     color: '#065f46', bg: '#d1fae5' },
  pvv:     { label: 'PVV',     color: '#9a3412', bg: '#ffedd5' },
}

const AREA_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  logistica: { label: 'Logística',      color: '#065f46', bg: '#d1fae5' },
  sistemas:  { label: 'Sistemas',       color: '#1e3a5f', bg: '#dbeafe' },
  general:   { label: 'Administración', color: '#7c2d12', bg: '#fed7aa' },
}

export default function GestionUsuariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [loading, setLoading]       = useState(false)
  const [modalOpen, setModalOpen]   = useState(false)
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [exito, setExito]           = useState('')
  const [filtroArea, setFiltroArea] = useState('todos')

  const [nombre, setNombre]     = useState('')
  const [username, setUsername] = useState('')
  const [rol, setRol]           = useState('usuario')
  const [area, setArea]         = useState('logistica')
  const [modulos, setModulos]   = useState<string[]>(() => modulosPorDefecto('usuario', 'logistica'))

  const [editModalOpen, setEditModalOpen]   = useState(false)
  const [editando, setEditando]             = useState(false)
  const [editUsuario, setEditUsuario]       = useState<Usuario | null>(null)
  const [editNombre, setEditNombre]         = useState('')
  const [editUsername, setEditUsername]     = useState('')
  const [editRol, setEditRol]               = useState('usuario')
  const [editArea, setEditArea]             = useState('logistica')
  const [editModulos, setEditModulos]       = useState<string[]>([])
  const [editResetPassword, setEditResetPassword] = useState(false)
  const [editError, setEditError]           = useState('')

  const [puntosVenta, setPuntosVenta]       = useState<PuntoVenta[]>([])
  const [puntoVenta, setPuntoVenta]         = useState<string>('')
  const [editPuntoVenta, setEditPuntoVenta] = useState<string>('')

  const sesionRol  = session?.user?.rol ?? ''
  const sesionArea = session?.user?.area ?? 'logistica'
  const esAdmin    = sesionRol === 'admin'
  const esLider    = sesionRol === 'lider' || esAdmin

  useEffect(() => {
    if (status === 'authenticated' && !esLider) {
      router.replace('/dashboard')
    }
  }, [status, esLider, router])

  useEffect(() => {
    if (!esAdmin) setArea(sesionArea)
  }, [esAdmin, sesionArea])

  // Recalcula los módulos por defecto cada vez que cambia rol/área en el modal de creación
  useEffect(() => {
    setModulos(modulosPorDefecto(rol, area))
  }, [rol, area])

  function toggleModulo(lista: string[], setLista: (m: string[]) => void, modulo: Modulo) {
    setLista(lista.includes(modulo) ? lista.filter(m => m !== modulo) : [...lista, modulo])
  }

  const cargarUsuarios = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios')
      const data = await res.json()
      setUsuarios(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && esLider) {
      cargarUsuarios()
      fetch('/api/pvn/puntos-venta').then(r => r.json()).then(setPuntosVenta).catch(() => {})
    }
  }, [status, esLider, cargarUsuarios])

  async function crearUsuario() {
    setError('')
    if (!nombre.trim() || !username.trim()) {
      setError('Nombre y usuario son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const body: Record<string, unknown> = { nombre, username, rol, area: esAdmin ? area : sesionArea }
      if (rol === 'pvn' && puntoVenta) body.punto_venta_id = parseInt(puntoVenta)
      if (!['pvn', 'pvv'].includes(rol)) body.modulos = modulos
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear usuario'); return }
      setExito(`Usuario "${nombre}" creado. Contraseña inicial: 123456`)
      setModalOpen(false)
      setNombre(''); setUsername(''); setRol('usuario'); setArea(esAdmin ? 'logistica' : sesionArea); setPuntoVenta('')
      cargarUsuarios()
    } finally {
      setGuardando(false)
    }
  }

  function abrirEdicion(u: Usuario) {
    setEditUsuario(u)
    setEditNombre(u.nombre)
    setEditUsername(u.username)
    setEditRol(u.rol)
    setEditArea(u.area)
    setEditPuntoVenta(u.punto_venta_id ? String(u.punto_venta_id) : '')
    setEditModulos(u.modulos ?? [])
    setEditResetPassword(false)
    setEditError('')
    setEditModalOpen(true)
  }

  async function guardarEdicion() {
    if (!editUsuario) return
    if (!editNombre.trim() || !editUsername.trim()) {
      setEditError('Nombre y usuario son obligatorios')
      return
    }
    setEditando(true)
    setEditError('')
    try {
      const body: Record<string, unknown> = {
        nombre: editNombre,
        username: editUsername,
        rol: editRol,
      }
      if (esAdmin) body.area = editArea
      if (editRol === 'pvn') body.punto_venta_id = editPuntoVenta ? parseInt(editPuntoVenta) : null
      if (!['pvn', 'pvv'].includes(editRol)) body.modulos = editModulos
      if (editResetPassword) body.resetPassword = true
      const res = await fetch(`/api/usuarios/${editUsuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? 'Error al guardar'); return }
      setExito(editResetPassword
        ? `Usuario "${editNombre}" actualizado — contraseña restablecida a 123456`
        : `Usuario "${editNombre}" actualizado correctamente`)
      setEditModalOpen(false)
      cargarUsuarios()
    } finally {
      setEditando(false)
    }
  }

  async function toggleActivo(u: Usuario) {
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !u.activo }),
    })
    if (res.ok) cargarUsuarios()
  }

  if (status === 'loading' || !esLider) return null

  const usuariosFiltrados = filtroArea === 'todos' ? usuarios : usuarios.filter(u => u.area === filtroArea)
  const areasDisponibles  = Array.from(new Set(usuarios.map(u => u.area))).sort()

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Gestión de Usuarios</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            {esAdmin ? 'Administra todos los usuarios del sistema' : `Usuarios del área de ${AREA_LABELS[sesionArea]?.label ?? sesionArea}`}
          </p>
        </div>
        <button onClick={() => { setModalOpen(true); setError(''); setExito('') }} style={btnPrimaryStyle}>
          + Nuevo Usuario
        </button>
      </div>

      {/* Éxito */}
      {exito && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: '#065f46', fontWeight: 600, fontSize: 14 }}>
          {exito}
          <button onClick={() => setExito('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Filtro por área (solo admin) */}
      {esAdmin && areasDisponibles.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <AreaBtn label={`Todas (${usuarios.length})`} active={filtroArea === 'todos'} onClick={() => setFiltroArea('todos')} />
          {areasDisponibles.map(a => (
            <AreaBtn key={a} label={`${AREA_LABELS[a]?.label ?? a} (${usuarios.filter(u => u.area === a).length})`} active={filtroArea === a} onClick={() => setFiltroArea(a)} />
          ))}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                {['Nombre', 'Usuario', 'Área', 'Rol', 'Estado', 'Contraseña', 'Creado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#334155', fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</td></tr>}
              {!loading && usuariosFiltrados.map((u, i) => {
                const rolInfo  = ROL_LABELS[u.rol]  ?? ROL_LABELS.usuario
                const areaInfo = AREA_LABELS[u.area] ?? { label: u.area, color: '#374151', bg: '#f3f4f6' }
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{u.nombre}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{u.username}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: areaInfo.color, background: areaInfo.bg }}>{areaInfo.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: rolInfo.color, background: rolInfo.bg }}>{rolInfo.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: u.activo ? '#065f46' : '#991b1b', background: u.activo ? '#d1fae5' : '#fee2e2' }}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.debe_cambiar_password
                        ? <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>Pendiente</span>
                        : <span style={{ fontSize: 12, color: '#64748b' }}>Personalizada</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>
                      {format(new Date(u.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {String(u.id) !== session?.user?.id && u.rol !== 'admin' && (
                          <button
                            onClick={() => abrirEdicion(u)}
                            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Editar
                          </button>
                        )}
                        {String(u.id) !== session?.user?.id && u.rol !== 'admin' && (
                          <button
                            onClick={() => toggleActivo(u)}
                            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: u.activo ? '#fff5f5' : '#f0fdf4', color: u.activo ? '#dc2626' : '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && usuariosFiltrados.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No hay usuarios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar usuario */}
      {editModalOpen && editUsuario && (
        <div onClick={() => setEditModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 4 }}>Editar Usuario</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Modifica los datos de <strong>{editUsuario.nombre}</strong>.</p>
            {editError && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{editError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Nombre completo</label>
                <input value={editNombre} onChange={e => setEditNombre(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nombre de usuario</label>
                <input value={editUsername} onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} style={inputStyle} />
              </div>
              {esAdmin && (
                <div>
                  <label style={labelStyle}>Área</label>
                  <select value={editArea} onChange={e => setEditArea(e.target.value)} style={inputStyle}>
                    <option value="logistica">Logística</option>
                    <option value="sistemas">Sistemas</option>
                    <option value="general">Administración (General)</option>
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Rol</label>
                <select value={editRol} onChange={e => setEditRol(e.target.value)} style={inputStyle}>
                  <option value="usuario">Usuario</option>
                  <option value="pvn">PVN (Punto de Venta)</option>
                  <option value="pvv">PVV (Punto Principal — app móvil)</option>
                  <option value="lider">Líder de Área</option>
                  {esAdmin && <option value="admin">Administrador</option>}
                </select>
              </div>
              {editRol === 'pvn' && puntosVenta.length > 0 && (
                <div>
                  <label style={labelStyle}>Punto de Venta</label>
                  <select value={editPuntoVenta} onChange={e => setEditPuntoVenta(e.target.value)} style={inputStyle}>
                    <option value="">— Sin asignar —</option>
                    {puntosVenta.filter(pv => pv.activo).map(pv => (
                      <option key={pv.id} value={String(pv.id)}>{pv.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {!['pvn', 'pvv'].includes(editRol) && (
                <ModulosChecklist seleccionados={editModulos} onToggle={m => toggleModulo(editModulos, setEditModulos, m)} />
              )}
              <div
                onClick={() => setEditResetPassword(v => !v)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${editResetPassword ? '#fca5a5' : '#e2e8f0'}`,
                  background: editResetPassword ? '#fee2e2' : '#f8fafc',
                }}
              >
                <input
                  type="checkbox"
                  checked={editResetPassword}
                  onChange={e => setEditResetPassword(e.target.checked)}
                  style={{ marginTop: 2, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: editResetPassword ? '#991b1b' : '#1e293b' }}>
                    Restablecer contraseña
                  </div>
                  <div style={{ fontSize: 12, color: editResetPassword ? '#b91c1c' : '#64748b', marginTop: 2 }}>
                    Pone la contraseña genérica <strong>123456</strong> y el usuario deberá cambiarla al iniciar sesión.
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button onClick={() => setEditModalOpen(false)} style={btnSecondaryStyle}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={editando} style={{ ...btnPrimaryStyle, flex: 1, opacity: editando ? 0.7 : 1 }}>
                {editando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear usuario */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 4 }}>Nuevo Usuario</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
              Contraseña inicial: <strong>123456</strong>. El usuario deberá cambiarla al primer ingreso.
            </p>
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Nombre completo</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" style={inputStyle} onKeyDown={e => e.key === 'Enter' && crearUsuario()} />
              </div>
              <div>
                <label style={labelStyle}>Nombre de usuario</label>
                <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="Ej: jperez" style={inputStyle} onKeyDown={e => e.key === 'Enter' && crearUsuario()} />
              </div>
              {esAdmin && (
                <div>
                  <label style={labelStyle}>Área</label>
                  <select value={area} onChange={e => setArea(e.target.value)} style={inputStyle}>
                    <option value="logistica">Logística</option>
                    <option value="sistemas">Sistemas</option>
                    <option value="general">Administración (General)</option>
                  </select>
                </div>
              )}
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
                <ModulosChecklist seleccionados={modulos} onToggle={m => toggleModulo(modulos, setModulos, m)} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button onClick={() => setModalOpen(false)} style={btnSecondaryStyle}>Cancelar</button>
              <button onClick={crearUsuario} disabled={guardando} style={{ ...btnPrimaryStyle, flex: 1, opacity: guardando ? 0.7 : 1 }}>
                {guardando ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModulosChecklist({ seleccionados, onToggle }: { seleccionados: string[]; onToggle: (m: Modulo) => void }) {
  return (
    <div>
      <label style={labelStyle}>Módulos de acceso</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
        {GRUPOS_MODULOS.map(grupo => (
          <div key={grupo.key}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0047BA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {grupo.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {grupo.modulos.map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={seleccionados.includes(m)} onChange={() => onToggle(m)} style={{ cursor: 'pointer' }} />
                  {MODULO_LABELS[m]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AreaBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid',
      borderColor: active ? '#0047BA' : '#e2e8f0',
      background: active ? '#0047BA' : '#fff',
      color: active ? '#fff' : '#64748b',
    }}>{label}</button>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }
const btnPrimaryStyle: React.CSSProperties = { padding: '10px 22px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const btnSecondaryStyle: React.CSSProperties = { padding: '10px 22px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
