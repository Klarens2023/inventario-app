'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { tieneModulo } from '@/lib/permissions'
import type { Data, Producto, PuntoVenta, DetalleProd } from '@/types/pvn-analisis'
import { getPuntosVenta, getAnalisis, getDetalleProducto } from '@/lib/api/pvn-analisis'
import { FiltrosBar } from '@/components/pvn-analisis/FiltrosBar'
import { TarjetasResumen } from '@/components/pvn-analisis/TarjetasResumen'
import { RankingProductos } from '@/components/pvn-analisis/RankingProductos'
import { TendenciaDiaria } from '@/components/pvn-analisis/TendenciaDiaria'
import { ConsumoIngredientes } from '@/components/pvn-analisis/ConsumoIngredientes'
import { DetalleProductoModal } from '@/components/pvn-analisis/DetalleProductoModal'

export default function AnalisisPVNPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData]       = useState<Data | null>(null)
  const [puntos, setPuntos]   = useState<PuntoVenta[]>([])
  const [loading, setLoading] = useState(false)
  const [pvFiltro, setPvFiltro] = useState('todos')
  const [desde, setDesde]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])

  const [detalle, setDetalle]   = useState<DetalleProd | null>(null)
  const [detLoading, setDetLoading] = useState(false)

  const { rol, modulos } = (session?.user ?? {}) as { rol?: string; modulos?: string[] }
  const canView = tieneModulo(rol ?? '', modulos, 'pvn_analisis')

  useEffect(() => {
    if (status === 'authenticated' && !canView) router.replace('/dashboard')
  }, [status, canView, router])

  useEffect(() => {
    if (status === 'authenticated' && canView) getPuntosVenta().then(setPuntos)
  }, [status, canView])

  const cargar = useCallback(async () => {
    setLoading(true)
    try { setData(await getAnalisis({ desde, hasta, pvFiltro })) }
    finally { setLoading(false) }
  }, [desde, hasta, pvFiltro])

  useEffect(() => {
    if (status === 'authenticated' && canView) cargar()
  }, [status, canView, cargar])

  async function abrirDetalle(p: Producto) {
    setDetLoading(true)
    setDetalle(null)
    try { setDetalle(await getDetalleProducto({ productoId: p.producto_id, desde, hasta, pvFiltro })) }
    finally { setDetLoading(false) }
  }

  function cerrarDetalle() {
    setDetalle(null)
    setDetLoading(false)
  }

  if (status === 'loading' || !canView) return null

  return (
    <div style={{ padding: '32px 28px', background: '#f8fafc', minHeight: '100vh' }}>
      <FiltrosBar
        puntos={puntos}
        pvFiltro={pvFiltro}
        onPvFiltroChange={setPvFiltro}
        desde={desde}
        onDesdeChange={setDesde}
        hasta={hasta}
        onHastaChange={setHasta}
        onFiltrar={cargar}
      />

      {loading && <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Calculando...</div>}

      {!loading && data && (
        <>
          <TarjetasResumen summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <RankingProductos productos={data.productos} onSeleccionar={abrirDetalle} />
            <TendenciaDiaria tendencia={data.tendencia} />
          </div>
          <ConsumoIngredientes ingredientes={data.ingredientes} />
        </>
      )}

      {(detLoading || detalle) && (
        <DetalleProductoModal
          detalle={detalle}
          loading={detLoading}
          desde={desde}
          hasta={hasta}
          pvFiltro={pvFiltro}
          puntos={puntos}
          onClose={cerrarDetalle}
        />
      )}
    </div>
  )
}
