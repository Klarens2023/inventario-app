'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { tieneModulo } from '@/lib/permissions'

type Comp = { componente_id?: number; componente_nombre: string; cantidad: number; unidad: string }
type Producto = { id: number; nombre: string; activo: boolean; componentes: Comp[] }

const UNIDADES = ['UND', 'KG', 'GRM', 'LT', 'ML']

function limpiar(n: string) { return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '') }

export default function CatalogoPVNPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [productos, setProductos]   = useState<Producto[]>([])
  const [loading, setLoading]       = useState(false)

  // — Producto modal —
  const [prodModal, setProdModal]   = useState(false)
  const [editProd, setEditProd]     = useState<Producto | null>(null)
  const [prodNombre, setProdNombre] = useState('')
  const [prodActivo, setProdActivo] = useState(true)
  const [comps, setComps]           = useState<Comp[]>([])
  const [compNombre, setCompNombre] = useState('')
  const [compCant, setCompCant]     = useState('')
  const [compUnidad, setCompUnidad] = useState('UND')
  const [prodError, setProdError]   = useState('')
  const [prodGuard, setProdGuard]   = useState(false)

  const { rol, modulos } = (session?.user ?? {}) as { rol?: string; modulos?: string[] }
  const canView = tieneModulo(rol ?? '', modulos, 'pvn_catalogo')

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  const cargarProductos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pvn/productos?all=1')
      const data = await res.json()
      setProductos(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargarProductos()
  }, [status, canView, cargarProductos])

  // ── Producto handlers ──────────────────────────────────────────────────────
  function abrirNuevoProd() {
    setEditProd(null)
    setProdNombre('')
    setProdActivo(true)
    setComps([])
    setProdError('')
    setProdModal(true)
  }

  function abrirEditarProd(p: Producto) {
    setEditProd(p)
    setProdNombre(limpiar(p.nombre))
    setProdActivo(p.activo)
    setComps(p.componentes.map(c => ({ ...c })))
    setProdError('')
    setProdModal(true)
  }

  function agregarComp() {
    if (!compNombre.trim() || !compCant) return
    const cant = parseFloat(compCant)
    if (isNaN(cant) || cant <= 0) return
    setComps(prev => [...prev, { componente_nombre: compNombre.trim(), cantidad: cant, unidad: compUnidad }])
    setCompNombre('')
    setCompCant('')
    setCompUnidad('UND')
  }

  function quitarComp(i: number) {
    setComps(prev => prev.filter((_, idx) => idx !== i))
  }

  async function guardarProducto() {
    if (!prodNombre.trim()) { setProdError('El nombre es obligatorio'); return }
    setProdGuard(true); setProdError('')
    try {
      const body = { nombre: prodNombre.trim(), activo: prodActivo, componentes: comps }
      const url  = editProd ? `/api/pvn/productos/${editProd.id}` : '/api/pvn/productos'
      const res  = await fetch(url, {
        method: editProd ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setProdError(data.error ?? 'Error'); return }
      setProdModal(false)
      cargarProductos()
    } finally {
      setProdGuard(false)
    }
  }

  async function toggleActivoProd(p: Producto) {
    await fetch(`/api/pvn/productos/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    })
    cargarProductos()
  }

if (status === 'loading' || !canView) return null

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Catálogo PVN</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Gestión de productos y puntos de venta</p>
      </div>


      {/* ──── PRODUCTOS ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={abrirNuevoProd} style={btnPrimary}>+ Nuevo Producto</button>
        </div>

          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Cargando...</div>}
            {!loading && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['ID', 'Producto', 'Ingredientes', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', opacity: p.activo ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{p.id}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b' }}>{limpiar(p.nombre)}</td>
                      <td style={{ padding: '10px 16px', color: '#64748b' }}>{p.componentes?.length ?? 0} ingredientes</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          color: p.activo ? '#065f46' : '#991b1b', background: p.activo ? '#d1fae5' : '#fee2e2' }}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => abrirEditarProd(p)} style={btnEdit}>Editar</button>
                          <button onClick={() => toggleActivoProd(p)} style={{ ...btnEdit, color: p.activo ? '#dc2626' : '#16a34a', borderColor: p.activo ? '#fca5a5' : '#bbf7d0' }}>
                            {p.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

      {/* ──── MODAL PRODUCTO ─────────────────────────────────────────────── */}
      {prodModal && (
        <div onClick={() => setProdModal(false)} style={modalOverlay}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={modalTitle}>{editProd ? 'Editar Producto' : 'Nuevo Producto'}</h2>

            {prodError && <div style={errBox}>{prodError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Nombre del producto</label>
                <input value={prodNombre} onChange={e => setProdNombre(e.target.value)} style={inp} placeholder="Ej: HELADO SUNDAE" />
              </div>
              {editProd && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Activo</label>
                  <button
                    onClick={() => setProdActivo(v => !v)}
                    style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      color: prodActivo ? '#065f46' : '#991b1b', borderColor: prodActivo ? '#6ee7b7' : '#fca5a5',
                      background: prodActivo ? '#d1fae5' : '#fee2e2' }}
                  >
                    {prodActivo ? 'Sí' : 'No'}
                  </button>
                </div>
              )}
            </div>

            {/* Lista de ingredientes */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10 }}>
                Ingredientes ({comps.length})
              </div>

              {comps.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Sin ingredientes aún</div>
              )}

              {comps.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f8fafc', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{c.componente_nombre}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0047BA', whiteSpace: 'nowrap' }}>
                    {c.cantidad % 1 === 0 ? c.cantidad : c.cantidad.toString()} {c.unidad}
                  </span>
                  <button onClick={() => quitarComp(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}

              {/* Agregar ingrediente */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label style={lbl}>Ingrediente</label>
                  <input value={compNombre} onChange={e => setCompNombre(e.target.value)} placeholder="Ej: MIX HELADO" style={inp}
                    onKeyDown={e => e.key === 'Enter' && agregarComp()} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Cantidad</label>
                  <input type="number" min={0} step="any" value={compCant} onChange={e => setCompCant(e.target.value)} style={inp}
                    onKeyDown={e => e.key === 'Enter' && agregarComp()} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Unidad</label>
                  <select value={compUnidad} onChange={e => setCompUnidad(e.target.value)} style={inp}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <button onClick={agregarComp} style={{ ...btnPrimary, padding: '9px 14px', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
                  + Agregar
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setProdModal(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={guardarProducto} disabled={prodGuard} style={{ ...btnPrimary, flex: 1, opacity: prodGuard ? 0.7 : 1 }}>
                {prodGuard ? 'Guardando...' : (editProd ? 'Guardar cambios' : 'Crear producto')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const lbl: React.CSSProperties       = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }
const inp: React.CSSProperties       = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties   = { padding: '10px 22px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 22px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const btnEdit: React.CSSProperties  = { padding: '5px 12px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalBox: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: '32px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }
const modalTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 20 }
const errBox: React.CSSProperties   = { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#991b1b', fontSize: 13 }
