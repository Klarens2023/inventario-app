'use client'
import { useSession } from 'next-auth/react'
import { useState, useEffect, useCallback } from 'react'
import type {
  Articulo, FiltrosArticulos, FiltrosKardex, MovimientoArticulo, TipoMovArticulo, Asignacion, FiltrosAsignaciones,
} from '@/types/repuestos'
import { fetchArticulos, fetchKardex, actualizarArticulo, fetchAsignaciones, verificarModulo } from '@/lib/api/repuestos'
import { ArticulosList }   from '@/components/repuestos/ArticulosList'
import { KardexList }      from '@/components/repuestos/KardexList'
import { ModalArticulo }   from '@/components/repuestos/ModalArticulo'
import { ModalMovimiento } from '@/components/repuestos/ModalMovimiento'
import { AsignacionesList } from '@/components/repuestos/AsignacionesList'
import { ModalRetiro }      from '@/components/repuestos/ModalRetiro'
import { ConsumoPanel }     from '@/components/repuestos/ConsumoPanel'

type Tab = 'inventario' | 'asignaciones' | 'consumo' | 'kardex'

export default function RepuestosPage() {
  const { status } = useSession()

  const [tab, setTab] = useState<Tab>('inventario')
  const [bloqueo, setBloqueo] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') verificarModulo().then(setBloqueo)
  }, [status])

  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [cargandoArt, setCargandoArt] = useState(false)
  const [filtrosArt, setFiltrosArt] = useState<FiltrosArticulos>({ buscar: '', categoria: '', stock: '', inactivos: false })

  const [kardex, setKardex] = useState<MovimientoArticulo[]>([])
  const [cargandoKdx, setCargandoKdx] = useState(false)
  const [filtrosKdx, setFiltrosKdx] = useState<FiltrosKardex>({ buscar: '', tipo: '', desde: '', hasta: '' })
  const [articuloKdx, setArticuloKdx] = useState<Articulo | null>(null)

  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [cargandoAsig, setCargandoAsig] = useState(false)
  const [filtrosAsig, setFiltrosAsig] = useState<FiltrosAsignaciones>({ buscar: '', estado: 'vigente', vencidos: false })
  const [vencidos, setVencidos] = useState(0)
  const [modalRetiro, setModalRetiro] = useState<Asignacion | null>(null)

  const [modalArticulo, setModalArticulo] = useState<{ articulo: Articulo | null } | null>(null)
  const [modalMov, setModalMov] = useState<{ articulo: Articulo; tipo: TipoMovArticulo } | null>(null)

  const cargarArticulos = useCallback(async () => {
    setCargandoArt(true)
    try { setArticulos(await fetchArticulos(filtrosArt)) } finally { setCargandoArt(false) }
  }, [filtrosArt])

  const cargarKardex = useCallback(async () => {
    setCargandoKdx(true)
    try { setKardex(await fetchKardex(filtrosKdx, articuloKdx?.codigo ?? '')) } finally { setCargandoKdx(false) }
  }, [filtrosKdx, articuloKdx])

  const cargarAsignaciones = useCallback(async () => {
    setCargandoAsig(true)
    try { setAsignaciones(await fetchAsignaciones(filtrosAsig)) } finally { setCargandoAsig(false) }
  }, [filtrosAsig])

  // Contador de préstamos vencidos para el aviso de la pestaña
  const contarVencidos = useCallback(async () => {
    setVencidos((await fetchAsignaciones({ vencidos: true })).length)
  }, [])

  // Filtros de texto: espera corta para no consultar en cada tecla
  useEffect(() => {
    if (status !== 'authenticated') return
    const t = setTimeout(cargarArticulos, 250)
    return () => clearTimeout(t)
  }, [status, cargarArticulos])

  useEffect(() => {
    if (status === 'authenticated') contarVencidos()
  }, [status, contarVencidos])

  useEffect(() => {
    if (status !== 'authenticated' || tab !== 'asignaciones') return
    const t = setTimeout(cargarAsignaciones, 250)
    return () => clearTimeout(t)
  }, [status, tab, cargarAsignaciones])

  useEffect(() => {
    if (status !== 'authenticated' || tab !== 'kardex') return
    const t = setTimeout(cargarKardex, 250)
    return () => clearTimeout(t)
  }, [status, tab, cargarKardex])

  function verKardex(a: Articulo) {
    setArticuloKdx(a)
    setTab('kardex')
  }

  async function cambiarActivo(a: Articulo, activo: boolean) {
    if (!activo && a.stock_actual > 0 &&
        !confirm(`${a.codigo} todavía tiene ${a.stock_actual} en stock. ¿Desactivarlo de todas formas?`)) return
    const res = await actualizarArticulo(a.codigo, { activo })
    if (res.error) { alert(res.error); return }
    cargarArticulos()
  }

  function refrescar() {
    cargarArticulos()
    contarVencidos()
    if (tab === 'kardex') cargarKardex()
    if (tab === 'asignaciones') cargarAsignaciones()
  }

  function trasMovimiento() {
    setModalMov(null)
    refrescar()
  }

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#94a3b8' }}>Cargando...</span>
    </div>
  )

  if (bloqueo) return (
    <div style={{ padding: '24px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>Repuestos, Insumos y Periféricos</h1>
      <div style={{ maxWidth: 640, padding: '16px 18px', borderRadius: 12, background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', fontSize: 14 }}>
        <b>El módulo todavía no está listo.</b>
        <p style={{ margin: '8px 0 0' }}>{bloqueo}</p>
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>Pídele al administrador del sistema que la ejecute; después recarga esta página.</p>
      </div>
    </div>
  )

  const TABS: [Tab, string][] = [
    ['inventario', 'Inventario'],
    ['asignaciones', vencidos > 0 ? `Asignaciones y préstamos (${vencidos} vencidos)` : 'Asignaciones y préstamos'],
    ['consumo', 'Consumo y gasto'],
    ['kardex', 'Kardex de movimientos'],
  ]

  return (
    <div style={{ padding: '24px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Repuestos, Insumos y Periféricos</h1>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b' }}>
        Stock de partes, consumibles y accesorios de TI, a qué equipo o persona está asignado cada uno, y el kardex de todo lo que entra y sale.
      </p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 18 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: tab === k ? 700 : 500,
            color: k === 'asignaciones' && vencidos > 0 ? '#dc2626' : tab === k ? '#0047BA' : '#64748b',
            borderBottom: tab === k ? '2px solid #0047BA' : '2px solid transparent', marginBottom: -2,
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'asignaciones' && (
        <AsignacionesList
          lista={asignaciones}
          cargando={cargandoAsig}
          filtros={filtrosAsig}
          onFiltro={f => setFiltrosAsig(prev => ({ ...prev, ...f }))}
          onRetirar={setModalRetiro}
        />
      )}

      {tab === 'consumo' && <ConsumoPanel />}

      {tab === 'asignaciones' || tab === 'consumo' ? null : tab === 'inventario' ? (
        <ArticulosList
          lista={articulos}
          cargando={cargandoArt}
          filtros={filtrosArt}
          onFiltro={f => setFiltrosArt(prev => ({ ...prev, ...f }))}
          onNuevo={() => setModalArticulo({ articulo: null })}
          onEditar={a => setModalArticulo({ articulo: a })}
          onMovimiento={(a, tipo) => setModalMov({ articulo: a, tipo })}
          onKardex={verKardex}
          onActivar={cambiarActivo}
        />
      ) : (
        <KardexList
          lista={kardex}
          cargando={cargandoKdx}
          filtros={filtrosKdx}
          articulo={articuloKdx}
          onFiltro={f => setFiltrosKdx(prev => ({ ...prev, ...f }))}
          onQuitarArticulo={() => setArticuloKdx(null)}
        />
      )}

      {modalArticulo && (
        <ModalArticulo
          articulo={modalArticulo.articulo}
          onClose={() => setModalArticulo(null)}
          onGuardado={() => { setModalArticulo(null); cargarArticulos() }}
        />
      )}

      {modalRetiro && (
        <ModalRetiro
          asignacion={modalRetiro}
          onClose={() => setModalRetiro(null)}
          onGuardado={() => { setModalRetiro(null); refrescar() }}
        />
      )}

      {modalMov && (
        <ModalMovimiento
          articulo={modalMov.articulo}
          tipoInicial={modalMov.tipo}
          onClose={() => setModalMov(null)}
          onGuardado={trasMovimiento}
        />
      )}
    </div>
  )
}
