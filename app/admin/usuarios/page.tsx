'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import type { Usuario, PuntoVenta } from '@/types/usuarios'
import { fetchUsuarios, crearUsuario, editarUsuario, toggleActivo } from '@/lib/api/usuarios'
import { AREA_LABELS } from '@/components/usuarios/constants'
import { UsuariosList }  from '@/components/usuarios/UsuariosList'
import { AreaFilterBar } from '@/components/usuarios/AreaFilterBar'
import { ModalCrear }    from '@/components/usuarios/ModalCrear'
import { ModalEditar }   from '@/components/usuarios/ModalEditar'
import { ModalAreas }      from '@/components/usuarios/ModalAreas'
import { PuntosVentaTab }  from '@/components/usuarios/PuntosVentaTab'

export default function GestionUsuariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const sesionRol  = session?.user?.rol  ?? ''
  const sesionArea = session?.user?.area ?? 'logistica'
  const esAdmin    = sesionRol === 'admin'
  const esLider    = sesionRol === 'lider' || esAdmin

  useEffect(() => {
    if (status === 'authenticated' && !esLider) router.replace('/dashboard')
  }, [status, esLider, router])

  const [usuarios,    setUsuarios]    = useState<Usuario[]>([])
  const [loading,     setLoading]     = useState(false)
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([])
  const [filtroArea,  setFiltroArea]  = useState('todos')
  const [exito,       setExito]       = useState('')

  const [modalCrear,  setModalCrear]  = useState(false)
  const [guardando,   setGuardando]   = useState(false)
  const [errorCrear,  setErrorCrear]  = useState('')

  const [modalEditar, setModalEditar] = useState(false)
  const [editando,    setEditando]    = useState(false)
  const [usuarioEdit, setUsuarioEdit] = useState<Usuario | null>(null)

  const [modalAreas,  setModalAreas]  = useState(false)
  const [tab,         setTab]         = useState<'usuarios' | 'puntos'>('usuarios')

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setUsuarios(await fetchUsuarios()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && esLider) {
      cargar()
      fetch('/api/pvn/puntos-venta').then(r => r.json()).then(setPuntosVenta).catch(() => {})
    }
  }, [status, esLider, cargar])

  async function handleCrear(body: Record<string, unknown>) {
    if (!body.nombre || !body.username) { setErrorCrear('Nombre y usuario son obligatorios'); return }
    setGuardando(true)
    const res = await crearUsuario(body)
    setGuardando(false)
    if (!res.ok) { setErrorCrear(res.error ?? ''); return }
    setExito(`Usuario "${body.nombre}" creado. Contraseña inicial: 123456`)
    setModalCrear(false)
    setErrorCrear('')
    cargar()
  }

  async function handleEditar(id: number, body: Record<string, unknown>) {
    setEditando(true)
    const res = await editarUsuario(id, body)
    setEditando(false)
    if (!res.ok) return
    const nombre = body.nombre as string
    setExito(body.resetPassword
      ? `Usuario "${nombre}" actualizado — contraseña restablecida a 123456`
      : `Usuario "${nombre}" actualizado correctamente`)
    setModalEditar(false)
    cargar()
  }

  async function handleToggleActivo(u: Usuario) {
    const ok = await toggleActivo(u.id, !u.activo)
    if (ok) cargar()
  }

  if (status === 'loading' || !esLider) return null

  const usuariosFiltrados = filtroArea === 'todos' ? usuarios : usuarios.filter(u => u.area === filtroArea)

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Gestión de Usuarios</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            {esAdmin ? 'Administra todos los usuarios del sistema' : `Usuarios del área de ${AREA_LABELS[sesionArea]?.label ?? sesionArea}`}
          </p>
        </div>
        {tab === 'usuarios' && (
          <div style={{ display: 'flex', gap: 10 }}>
            {esAdmin && (
              <button onClick={() => setModalAreas(true)} style={{ padding: '10px 22px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                ⚙ Áreas y Roles
              </button>
            )}
            <button onClick={() => { setModalCrear(true); setErrorCrear('') }} style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              + Nuevo Usuario
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([['usuarios', 'Usuarios'], ['puntos', 'Puntos de Venta']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            background: tab === key ? '#fff' : 'transparent',
            color: tab === key ? '#0047BA' : '#64748b',
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'usuarios' && (
        <>
          {exito && (
            <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: '#065f46', fontWeight: 600, fontSize: 14 }}>
              {exito}
              <button onClick={() => setExito('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}
          {esAdmin && usuarios.length > 0 && (
            <AreaFilterBar usuarios={usuarios} filtroArea={filtroArea} onChange={setFiltroArea} />
          )}
          <UsuariosList
            usuarios={usuariosFiltrados}
            loading={loading}
            sessionUserId={session?.user?.id}
            esAdmin={esAdmin}
            onEditar={u => { setUsuarioEdit(u); setModalEditar(true) }}
            onToggleActivo={handleToggleActivo}
          />
        </>
      )}

      {tab === 'puntos' && <PuntosVentaTab />}

      {modalCrear && (
        <ModalCrear
          esAdmin={esAdmin}
          sesionArea={sesionArea}
          puntosVenta={puntosVenta}
          guardando={guardando}
          error={errorCrear}
          onClose={() => setModalCrear(false)}
          onCrear={handleCrear}
        />
      )}

      {modalEditar && usuarioEdit && (
        <ModalEditar
          usuario={usuarioEdit}
          esAdmin={esAdmin}
          sessionUserId={session?.user?.id}
          puntosVenta={puntosVenta}
          editando={editando}
          onClose={() => setModalEditar(false)}
          onGuardar={handleEditar}
        />
      )}

      {modalAreas && (
        <ModalAreas usuarios={usuarios} onClose={() => setModalAreas(false)} />
      )}
    </div>
  )
}
