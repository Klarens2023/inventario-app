'use client'
import { useState } from 'react'
import type { Articulo, Categoria, CamposArticulo } from '@/types/repuestos'
import { crearArticulo, actualizarArticulo } from '@/lib/api/repuestos'
import { inp, btnPrimary, btnSec } from '@/components/movimientos/styles'
import { CATEGORIAS, TIPOS_POR_CATEGORIA, UNIDADES, ARTICULO_VACIO } from './constants'
import { Campo, Modal } from './shared'

type Props = {
  articulo: Articulo | null   // null = nuevo
  onClose: () => void
  onGuardado: () => void
}

function desdeArticulo(a: Articulo): CamposArticulo {
  return {
    categoria: a.categoria, tipo: a.tipo, descripcion: a.descripcion, marca: a.marca ?? '',
    referencia: a.referencia ?? '', compatible_con: a.compatible_con ?? '', unidad: a.unidad,
    stock_inicial: String(a.stock_actual), stock_minimo: String(a.stock_minimo), ubicacion: a.ubicacion ?? '',
    costo_unitario: a.costo_unitario ? String(Number(a.costo_unitario)) : '', observaciones: a.observaciones ?? '',
  }
}

export function ModalArticulo({ articulo, onClose, onGuardado }: Props) {
  const esNuevo = articulo === null
  const [c, setC] = useState<CamposArticulo>(articulo ? desdeArticulo(articulo) : ARTICULO_VACIO())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof CamposArticulo, v: string) => setC(prev => ({ ...prev, [k]: v }))
  const tipos = c.categoria ? TIPOS_POR_CATEGORIA[c.categoria] : []

  async function guardar() {
    setError('')
    if (!c.categoria || !c.tipo || !c.descripcion.trim()) { setError('Categoría, tipo y descripción son obligatorios'); return }
    setGuardando(true)
    try {
      const res = articulo ? await actualizarArticulo(articulo.codigo, c) : await crearArticulo(c)
      if (res.error) { setError(res.error); return }
      onGuardado()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={articulo ? `Editar ${articulo.codigo}` : 'Nuevo artículo'}
      subtitulo={articulo ? articulo.descripcion : 'Repuesto, insumo o periférico que se controla por stock'}
      onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Campo label="Categoría *">
          <select value={c.categoria} style={inp}
            onChange={e => setC(prev => ({ ...prev, categoria: e.target.value as Categoria, tipo: '' }))}>
            <option value="">Seleccionar...</option>
            {CATEGORIAS.map(x => <option key={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo *">
          <select value={c.tipo} onChange={e => set('tipo', e.target.value)} style={inp} disabled={!c.categoria}>
            <option value="">Seleccionar...</option>
            {tipos.map(x => <option key={x}>{x}</option>)}
            {c.tipo && !tipos.includes(c.tipo) && <option>{c.tipo}</option>}
          </select>
        </Campo>
        <Campo label="Descripción *" span={2}>
          <input value={c.descripcion} onChange={e => set('descripcion', e.target.value)} style={inp}
            placeholder="Ej: Tóner HP 83A negro, Memoria DDR4 8 GB SODIMM, Mouse USB óptico" />
        </Campo>
        <Campo label="Marca">
          <input value={c.marca} onChange={e => set('marca', e.target.value)} style={inp} />
        </Campo>
        <Campo label="Referencia / N.º de parte">
          <input value={c.referencia} onChange={e => set('referencia', e.target.value)} style={inp} placeholder="Ej: CF283A" />
        </Campo>
        <Campo label="Compatible con" span={2}>
          <input value={c.compatible_con} onChange={e => set('compatible_con', e.target.value)} style={inp}
            placeholder="Ej: HP LaserJet Pro M125 / M127, portátiles HP 240 G6" />
        </Campo>
        <Campo label="Unidad de medida">
          <select value={c.unidad} onChange={e => set('unidad', e.target.value)} style={inp}>
            {UNIDADES.map(x => <option key={x}>{x}</option>)}
          </select>
        </Campo>
        <Campo label="Ubicación / bodega">
          <input value={c.ubicacion} onChange={e => set('ubicacion', e.target.value)} style={inp} placeholder="Ej: Oficina Sistemas — estante 2" />
        </Campo>
        {esNuevo ? (
          <Campo label="Stock inicial">
            <input type="number" min={0} value={c.stock_inicial} onChange={e => set('stock_inicial', e.target.value)} style={inp} />
          </Campo>
        ) : (
          <Campo label="Stock actual">
            <input value={c.stock_inicial} disabled style={{ ...inp, background: '#f8fafc', color: '#64748b' }}
              title="El stock solo cambia con entradas, salidas o ajustes" />
          </Campo>
        )}
        <Campo label="Stock mínimo (alerta)">
          <input type="number" min={0} value={c.stock_minimo} onChange={e => set('stock_minimo', e.target.value)} style={inp} />
        </Campo>
        <Campo label="Costo unitario (COP)">
          <input type="number" min={0} value={c.costo_unitario} onChange={e => set('costo_unitario', e.target.value)} style={inp} />
        </Campo>
        <div />
        <Campo label="Observaciones" span={2}>
          <textarea value={c.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        </Campo>
      </div>

      {error && <div style={{ marginTop: 14, padding: '9px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={{ ...btnPrimary, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando...' : esNuevo ? 'Crear artículo' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}
