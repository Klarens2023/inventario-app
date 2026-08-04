'use client'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense } from 'react'
import type { MovimientoResumen, FiltrosMovimientos } from '@/types/movimientos'
import type { EquipoBusqueda } from '@/types/movimientos'
import { fetchMovimientos } from '@/lib/api/movimientos'
import { MovimientosList }   from '@/components/movimientos/MovimientosList'
import { MovimientoForm }    from '@/components/movimientos/MovimientoForm'
import { MovimientoDetalle } from '@/components/movimientos/MovimientoDetalle'

type Vista = 'lista' | 'nuevo' | 'detalle'

// useSearchParams() exige un límite de Suspense en build estático (Next.js
// no puede prerenderizar la página si no lo tiene) — de ahí este envoltorio.
export default function MovimientosTICPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <span style={{ color: '#94a3b8' }}>Cargando...</span>
      </div>
    }>
      <MovimientosTICContent />
    </Suspense>
  )
}

function MovimientosTICContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const rol     = session?.user?.rol ?? ''
  const isAdmin = rol === 'admin'

  useEffect(() => {
    if (status === 'authenticated' && !['admin', 'lider', 'usuario'].includes(rol)) {
      router.replace('/dashboard')
    }
  }, [status, rol, router])

  const [vista,      setVista]      = useState<Vista>('lista')
  const [detalleId,  setDetalleId]  = useState('')
  const [proximoId,  setProximoId]  = useState('')
  const [equipoInicial, setEquipoInicial] = useState<EquipoBusqueda | null>(null)
  const [lista,      setLista]      = useState<MovimientoResumen[]>([])
  const [cargando,   setCargando]   = useState(false)
  const [filtros,    setFiltros]    = useState<FiltrosMovimientos>({ buscar: '', estado: '', desde: '', hasta: '' })

  // Deep-link: "Hacer movimiento" desde el inventario de equipos (?equipo_id=...)
  // o abrir el detalle de un movimiento puntual (?ver=TIC-0001)
  useEffect(() => {
    if (status !== 'authenticated') return
    const ver = searchParams.get('ver')
    if (ver) { setDetalleId(ver); setVista('detalle'); return }

    const equipoId = searchParams.get('equipo_id')
    if (equipoId) {
      setEquipoInicial({
        id: equipoId,
        tipo_equipo: searchParams.get('tipo_equipo') ?? '',
        marca: searchParams.get('marca') ?? '',
        modelo: searchParams.get('modelo') ?? '',
        numero_serie: searchParams.get('numero_serie') ?? '',
        usuario_asignado: '',
      })
      setVista('nuevo')
      router.replace('/sistemas/movimientos')
    }
  }, [status, searchParams, router])

  const cargarLista = useCallback(async () => {
    setCargando(true)
    try {
      const data = await fetchMovimientos(filtros)
      setLista(data)
    } finally {
      setCargando(false)
    }
  }, [filtros])

  useEffect(() => {
    if (status === 'authenticated') cargarLista()
  }, [status, cargarLista])

  function siguienteId() {
    return lista.length > 0
      ? `TIC-${String(parseInt(lista[0].id.replace('TIC-', ''), 10) + 1).padStart(4, '0')}`
      : 'TIC-0001'
  }

  // Si se llegó por deep-link (?equipo_id=...) antes de que cargarLista() terminara,
  // el consecutivo aún no se había podido calcular — se completa aquí.
  useEffect(() => {
    if (vista === 'nuevo' && !proximoId && !cargando) setProximoId(siguienteId())
  }, [vista, proximoId, cargando, lista])

  function abrirNuevo() {
    setEquipoInicial(null)
    setProximoId(siguienteId())
    setVista('nuevo')
  }

  function abrirDetalle(id: string) {
    setDetalleId(id)
    setVista('detalle')
  }

  if (status === 'loading') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#94a3b8' }}>Cargando...</span>
    </div>
  )

  if (vista === 'detalle') return (
    <MovimientoDetalle
      id={detalleId}
      isAdmin={isAdmin}
      onVolver={() => setVista('lista')}
      onEstadoCambiado={cargarLista}
    />
  )

  if (vista === 'nuevo') return (
    <MovimientoForm
      proximoId={proximoId}
      equipoInicial={equipoInicial}
      onCancelar={() => { setEquipoInicial(null); setVista('lista') }}
      onGuardado={() => { setEquipoInicial(null); cargarLista(); setVista('lista') }}
    />
  )

  return (
    <MovimientosList
      lista={lista}
      cargando={cargando}
      filtros={filtros}
      onFiltro={cambios => setFiltros(prev => ({ ...prev, ...cambios }))}
      onBuscar={cargarLista}
      onNuevo={abrirNuevo}
      onVerDetalle={abrirDetalle}
    />
  )
}
