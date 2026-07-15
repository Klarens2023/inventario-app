'use client'
import { useState } from 'react'
import type { Usuario } from '@/types/usuarios'
import type { AreaInfo, Modulo } from '@/lib/permissions'
import { ROL_LABELS, btnSecondary, btnPrimary, labelStyle, inputStyle } from './constants'
import { ModulosChecklist } from './ModulosChecklist'

type Props = {
  usuarios: Usuario[]
  areas: AreaInfo[]
  esAdmin: boolean
  onAreasChanged: () => void
  onClose: () => void
}

const PALETA = [
  { color: '#065f46', bg: '#d1fae5' },
  { color: '#1e3a5f', bg: '#dbeafe' },
  { color: '#7c2d12', bg: '#fed7aa' },
  { color: '#6b21a8', bg: '#f3e8ff' },
  { color: '#92400e', bg: '#fef3c7' },
  { color: '#9d174d', bg: '#fce7f3' },
  { color: '#374151', bg: '#f3f4f6' },
]

export function ModalAreas({ usuarios, areas, esAdmin, onAreasChanged, onClose }: Props) {
  const [creando, setCreando]       = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [label, setLabel]           = useState('')
  const [paletaIdx, setPaletaIdx]   = useState(0)
  const [rolesForm, setRolesForm]   = useState<string[]>(['usuario', 'lider'])
  const [modUsuario, setModUsuario] = useState<string[]>([])
  const [modLider, setModLider]     = useState<string[]>([])
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)
  const [errorEliminar, setErrorEliminar] = useState('')

  function abrirCrear() {
    setEditandoId(null)
    setLabel('')
    setPaletaIdx(areas.length % PALETA.length)
    setRolesForm(['usuario', 'lider'])
    setModUsuario([])
    setModLider([])
    setError('')
    setCreando(true)
  }

  function abrirEditar(a: AreaInfo) {
    setCreando(false)
    setEditandoId(a.id)
    setLabel(a.label)
    const idx = PALETA.findIndex(p => p.color === a.color && p.bg === a.bg)
    setPaletaIdx(idx >= 0 ? idx : 0)
    setRolesForm(a.roles_permitidos)
    setModUsuario(a.modulos_usuario)
    setModLider(a.modulos_lider)
    setError('')
  }

  function cancelarForm() {
    setCreando(false)
    setEditandoId(null)
    setError('')
  }

  function toggleRolForm(r: string) {
    setRolesForm(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  async function guardar() {
    if (!label.trim()) { setError('El nombre del área es obligatorio'); return }
    setGuardando(true)
    setError('')
    try {
      const body = {
        label: label.trim(),
        color: PALETA[paletaIdx].color,
        bg: PALETA[paletaIdx].bg,
        roles_permitidos: rolesForm,
        modulos_usuario: modUsuario,
        modulos_lider: modLider,
      }
      const url = editandoId ? `/api/areas/${editandoId}` : '/api/areas'
      const res = await fetch(url, {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      cancelarForm()
      onAreasChanged()
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(a: AreaInfo) {
    if (!confirm(`¿Eliminar el área "${a.label}"?`)) return
    setEliminandoId(a.id)
    setErrorEliminar('')
    try {
      const res = await fetch(`/api/areas/${a.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setErrorEliminar(data.error ?? 'No se pudo eliminar'); return }
      onAreasChanged()
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 560, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '88vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 6 }}>Áreas y Roles</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          Estructura de áreas del sistema. Los módulos por defecto se asignan al crear un usuario nuevo en esa área
          (el admin puede ajustarlos igual desde el checklist de cada usuario).
        </p>

        {errorEliminar && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{errorEliminar}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {areas.map(a => {
            const usuariosDeArea = usuarios.filter(u => (['pvn', 'pvv'].includes(u.rol) ? 'puntos_venta' : u.area) === a.key)
            const enEdicion = editandoId === a.id
            return (
              <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: a.color, background: a.bg }}>
                    {a.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{usuariosDeArea.length} usuario{usuariosDeArea.length !== 1 ? 's' : ''}</span>
                  {a.protegida && <span style={{ fontSize: 11, color: '#94a3b8' }}>· área del sistema</span>}
                  <span style={{ flex: 1 }} />
                  {esAdmin && !enEdicion && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => abrirEditar(a)} title="Editar área" style={iconBtn}>✏️</button>
                      {!a.protegida && (
                        <button onClick={() => eliminar(a)} disabled={eliminandoId === a.id} title="Eliminar área" style={{ ...iconBtn, opacity: eliminandoId === a.id ? 0.5 : 1 }}>🗑️</button>
                      )}
                    </div>
                  )}
                </div>

                {!enEdicion && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {a.roles_permitidos.map(r => {
                      const ri = ROL_LABELS[r]
                      return ri ? (
                        <span key={r} style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: ri.color, background: ri.bg }}>
                          {ri.label}
                        </span>
                      ) : null
                    })}
                  </div>
                )}

                {enEdicion && (
                  <AreaForm
                    label={label} setLabel={setLabel}
                    paletaIdx={paletaIdx} setPaletaIdx={setPaletaIdx}
                    rolesForm={rolesForm} toggleRolForm={toggleRolForm}
                    modUsuario={modUsuario} setModUsuario={setModUsuario}
                    modLider={modLider} setModLider={setModLider}
                    error={error} guardando={guardando}
                    onGuardar={guardar} onCancelar={cancelarForm}
                  />
                )}
              </div>
            )
          })}
        </div>

        {esAdmin && !creando && editandoId === null && (
          <button onClick={abrirCrear} style={{ ...btnSecondary, width: '100%', marginTop: 16 }}>+ Nueva área</button>
        )}

        {creando && (
          <div style={{ border: '1px dashed #93c5fd', borderRadius: 12, padding: '16px 18px', marginTop: 16, background: '#f8fafc' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Nueva área</div>
            <AreaForm
              label={label} setLabel={setLabel}
              paletaIdx={paletaIdx} setPaletaIdx={setPaletaIdx}
              rolesForm={rolesForm} toggleRolForm={toggleRolForm}
              modUsuario={modUsuario} setModUsuario={setModUsuario}
              modLider={modLider} setModLider={setModLider}
              error={error} guardando={guardando}
              onGuardar={guardar} onCancelar={cancelarForm}
            />
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button onClick={onClose} style={{ ...btnSecondary, width: '100%' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

type FormProps = {
  label: string; setLabel: (v: string) => void
  paletaIdx: number; setPaletaIdx: (v: number) => void
  rolesForm: string[]; toggleRolForm: (r: string) => void
  modUsuario: string[]; setModUsuario: (v: string[]) => void
  modLider: string[]; setModLider: (v: string[]) => void
  error: string; guardando: boolean
  onGuardar: () => void; onCancelar: () => void
}

function AreaForm({ label, setLabel, paletaIdx, setPaletaIdx, rolesForm, toggleRolForm, modUsuario, setModUsuario, modLider, setModLider, error, guardando, onGuardar, onCancelar }: FormProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13 }}>{error}</div>
      )}
      <div>
        <label style={labelStyle}>Nombre del área</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Contabilidad" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Color</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {PALETA.map((p, i) => (
            <button
              key={i} onClick={() => setPaletaIdx(i)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: p.bg, cursor: 'pointer',
                border: i === paletaIdx ? `2px solid ${p.color}` : '2px solid transparent',
                boxShadow: i === paletaIdx ? `0 0 0 2px #fff, 0 0 0 3px ${p.color}` : 'none',
              }}
            />
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Roles permitidos en esta área</label>
        <div style={{ display: 'flex', gap: 14 }}>
          {['usuario', 'lider'].map(r => (
            <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
              <input type="checkbox" checked={rolesForm.includes(r)} onChange={() => toggleRolForm(r)} style={{ cursor: 'pointer' }} />
              {ROL_LABELS[r]?.label ?? r}
            </label>
          ))}
        </div>
      </div>
      <ModulosChecklist titulo="Módulos por defecto — rol Usuario" seleccionados={modUsuario} onToggle={(m: Modulo) => setModUsuario(modUsuario.includes(m) ? modUsuario.filter(x => x !== m) : [...modUsuario, m])} />
      <ModulosChecklist titulo="Módulos por defecto — rol Líder" seleccionados={modLider} onToggle={(m: Modulo) => setModLider(modLider.includes(m) ? modLider.filter(x => x !== m) : [...modLider, m])} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancelar} style={btnSecondary}>Cancelar</button>
        <button onClick={onGuardar} disabled={guardando} style={{ ...btnPrimary, flex: 1, opacity: guardando ? 0.7 : 1 }}>
          {guardando ? 'Guardando...' : 'Guardar área'}
        </button>
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = { background: '#f1f5f9', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, flexShrink: 0 }
