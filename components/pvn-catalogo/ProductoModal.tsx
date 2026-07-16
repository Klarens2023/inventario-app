'use client'
import { useState, useEffect } from 'react'
import type { Comp, Producto } from '@/types/pvn-catalogo'
import { guardarProducto } from '@/lib/api/pvn-catalogo'
import { limpiar } from './utils'
import { UNIDADES, lbl, inp, btnPrimary, btnSecondary, modalOverlay, modalBox, modalTitle, errBox } from './constants'

type Props = {
  editProd: Producto | null
  onClose: () => void
  onGuardado: () => void
}

export function ProductoModal({ editProd, onClose, onGuardado }: Props) {
  const [nombre, setNombre] = useState('')
  const [activo, setActivo] = useState(true)
  const [comps, setComps]   = useState<Comp[]>([])
  const [compNombre, setCompNombre] = useState('')
  const [compCant, setCompCant]     = useState('')
  const [compUnidad, setCompUnidad] = useState('UND')
  const [error, setError]         = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (editProd) {
      setNombre(limpiar(editProd.nombre))
      setActivo(editProd.activo)
      setComps(editProd.componentes.map(c => ({ ...c })))
    } else {
      setNombre(''); setActivo(true); setComps([])
    }
    setError('')
  }, [editProd])

  function agregarComp() {
    if (!compNombre.trim() || !compCant) return
    const cant = parseFloat(compCant)
    if (isNaN(cant) || cant <= 0) return
    setComps(prev => [...prev, { componente_nombre: compNombre.trim(), cantidad: cant, unidad: compUnidad }])
    setCompNombre(''); setCompCant(''); setCompUnidad('UND')
  }

  function quitarComp(i: number) {
    setComps(prev => prev.filter((_, idx) => idx !== i))
  }

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true); setError('')
    try {
      const { ok, error: errMsg } = await guardarProducto({ nombre: nombre.trim(), activo, componentes: comps }, editProd?.id)
      if (!ok) { setError(errMsg ?? 'Error'); return }
      onGuardado()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div onClick={onClose} style={modalOverlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={modalTitle}>{editProd ? 'Editar Producto' : 'Nuevo Producto'}</h2>

        {error && <div style={errBox}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nombre del producto</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} style={inp} placeholder="Ej: HELADO SUNDAE" />
          </div>
          {editProd && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Activo</label>
              <button
                onClick={() => setActivo(v => !v)}
                style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  color: activo ? '#065f46' : '#991b1b', borderColor: activo ? '#6ee7b7' : '#fca5a5',
                  background: activo ? '#d1fae5' : '#fee2e2' }}
              >
                {activo ? 'Sí' : 'No'}
              </button>
            </div>
          )}
        </div>

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
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ ...btnPrimary, flex: 1, opacity: guardando ? 0.7 : 1 }}>
            {guardando ? 'Guardando...' : (editProd ? 'Guardar cambios' : 'Crear producto')}
          </button>
        </div>
      </div>
    </div>
  )
}
