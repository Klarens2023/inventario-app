'use client'
import { useState, useCallback } from 'react'
import { labelStyle, inputStyle, btnPrimary, btnSecondary } from './constants'

type PuntoVenta = { id: number; nombre: string; activo: boolean; tipo: string; usuarios_asignados: number }

export function PuntosVentaTab() {
  const [puntos,   setPuntos]   = useState<PuntoVenta[]>([])
  const [cargado,  setCargado]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [modal,    setModal]    = useState(false)
  const [editPv,   setEditPv]   = useState<PuntoVenta | null>(null)
  const [nombre,   setNombre]   = useState('')
  const [tipo,     setTipo]     = useState<'nacional' | 'principal'>('nacional')
  const [error,    setError]    = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch('/api/pvn/puntos-venta').then(r => r.json())
      setPuntos(Array.isArray(data) ? data : [])
      setCargado(true)
    } finally { setLoading(false) }
  }, [])

  // Cargar la primera vez que se monta
  useState(() => { cargar() })

  function abrirNuevo() {
    setEditPv(null); setNombre(''); setTipo('nacional'); setError(''); setModal(true)
  }
  function abrirEditar(pv: PuntoVenta) {
    setEditPv(pv); setNombre(pv.nombre); setTipo(pv.tipo as 'nacional' | 'principal'); setError(''); setModal(true)
  }

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true); setError('')
    try {
      const url = editPv ? `/api/pvn/puntos-venta/${editPv.id}` : '/api/pvn/puntos-venta'
      const res = await fetch(url, {
        method: editPv ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), tipo }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setModal(false)
      cargar()
    } finally { setGuardando(false) }
  }

  async function toggleActivo(pv: PuntoVenta) {
    await fetch(`/api/pvn/puntos-venta/${pv.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !pv.activo }),
    })
    cargar()
  }

  const grupos = [
    { tipo: 'nacional',  label: 'Puntos Nacionales (PVN)', color: '#065f46', bg: '#d1fae5', hint: 'Rol PVN' },
    { tipo: 'principal', label: 'Puntos Principales (PVV)', color: '#9a3412', bg: '#ffedd5', hint: 'Rol PVV' },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={abrirNuevo} style={btnPrimary}>+ Nuevo Punto de Venta</button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}

      {!loading && cargado && puntos.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94a3b8', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          No hay puntos de venta. Crea el primero.
        </div>
      )}

      {grupos.map(({ tipo: t, label, color, bg, hint }) => {
        const grupo = puntos.filter(pv => pv.tipo === t)
        if (grupo.length === 0) return null
        return (
          <div key={t} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, color, background: bg }}>{label}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{grupo.length} punto{grupo.length !== 1 ? 's' : ''} · {hint}</span>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                    {['Punto de Venta', 'Usuarios asignados', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: '#334155', fontSize: 13, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupo.map((pv, i) => (
                    <tr key={pv.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', opacity: pv.activo ? 1 : 0.55 }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{pv.nombre}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        <span style={{ fontWeight: 700, color: pv.usuarios_asignados > 0 ? '#0047BA' : '#94a3b8' }}>{pv.usuarios_asignados}</span> usuarios
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          color: pv.activo ? '#065f46' : '#991b1b', background: pv.activo ? '#d1fae5' : '#fee2e2' }}>
                          {pv.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => abrirEditar(pv)} style={btnEdit}>Editar</button>
                          <button onClick={() => toggleActivo(pv)} style={{ ...btnEdit, color: pv.activo ? '#dc2626' : '#16a34a', borderColor: pv.activo ? '#fca5a5' : '#bbf7d0' }}>
                            {pv.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 20 }}>
              {editPv ? 'Editar Punto de Venta' : 'Nuevo Punto de Venta'}
            </h2>
            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {([
                    { value: 'nacional',  label: 'Nacional (PVN)',  color: '#065f46', bg: '#d1fae5', hint: 'Rol PVN' },
                    { value: 'principal', label: 'Principal (PVV)', color: '#9a3412', bg: '#ffedd5', hint: 'Rol PVV' },
                  ] as const).map(opt => (
                    <button key={opt.value} onClick={() => setTipo(opt.value)} style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      border: `2px solid ${tipo === opt.value ? opt.color : '#e2e8f0'}`,
                      background: tipo === opt.value ? opt.bg : '#f8fafc',
                      color: tipo === opt.value ? opt.color : '#64748b',
                      fontWeight: 700, fontSize: 13,
                    }}>
                      <div>{opt.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.8 }}>{opt.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Nombre</label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  style={inputStyle}
                  placeholder={tipo === 'nacional' ? 'Ej: Bogotá Centro' : 'Ej: Valledupar Principal'}
                  onKeyDown={e => e.key === 'Enter' && guardar()}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ ...btnPrimary, flex: 1, opacity: guardando ? 0.7 : 1 }}>
                {guardando ? 'Guardando...' : (editPv ? 'Guardar' : 'Crear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const btnEdit: React.CSSProperties = { padding: '5px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
