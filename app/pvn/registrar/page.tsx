'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Producto } from '@/types/pvn-registrar'
import { getProductos, postRegistro } from '@/lib/api/pvn-registrar'
import { hoyBogota } from '@/components/pvn-registrar/utils'
import { TurnoForm } from '@/components/pvn-registrar/TurnoForm'
import { ProductosGrupos } from '@/components/pvn-registrar/ProductosGrupos'
import { ResumenBar } from '@/components/pvn-registrar/ResumenBar'

export default function RegistrarVentasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [productos, setProductos] = useState<Producto[]>([])
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [turno, setTurno]           = useState('Cierre')
  const [fecha]                     = useState(hoyBogota)
  const [obs, setObs]               = useState('')
  const [guardando, setGuardando]   = useState(false)
  const [error, setError]           = useState('')
  const [exito, setExito]           = useState('')

  const rol = (session?.user as { rol?: string })?.rol ?? ''

  useEffect(() => {
    if (status === 'authenticated' && !['pvn', 'admin', 'lider'].includes(rol)) {
      router.replace('/dashboard')
    }
  }, [status, rol, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    getProductos().then(data => {
      setProductos(data)
      const init: Record<number, number> = {}
      data.forEach(p => { init[p.id] = 0 })
      setCantidades(init)
    })
  }, [status])

  async function registrar() {
    setError('')
    const detalle = productos
      .filter(p => (cantidades[p.id] ?? 0) > 0)
      .map(p => ({ producto_id: p.id, producto_nombre: p.nombre, cantidad: cantidades[p.id] }))

    if (detalle.length === 0) { setError('Ingresa al menos un producto vendido'); return }

    setGuardando(true)
    try {
      const { ok, error: errMsg } = await postRegistro({ fecha, turno, observaciones: obs.trim() || null, detalle })
      if (!ok) { setError(errMsg ?? 'Error al guardar'); return }
      setExito(`Ventas del ${fecha} (${turno}) registradas — ${detalle.length} productos, ${detalle.reduce((s, d) => s + d.cantidad, 0)} unidades`)
      const reset: Record<number, number> = {}
      productos.forEach(p => { reset[p.id] = 0 })
      setCantidades(reset)
      setObs('')
    } finally {
      setGuardando(false)
    }
  }

  function setQty(id: number, v: number) {
    setCantidades(prev => ({ ...prev, [id]: Math.max(0, v) }))
  }

  if (status === 'loading') return null

  const totalUnidades  = Object.values(cantidades).reduce((a, b) => a + b, 0)
  const totalProductos = productos.filter(p => (cantidades[p.id] ?? 0) > 0).length

  return (
    <div style={{ padding: '32px 28px', maxWidth: 800, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Registrar Ventas</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Ingresa las cantidades vendidas por turno</p>
      </div>

      {exito && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: '#065f46', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{exito}</span>
          <button onClick={() => setExito('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: '#991b1b', fontSize: 14 }}>
          {error}
        </div>
      )}

      <TurnoForm fecha={fecha} turno={turno} onTurnoChange={setTurno} obs={obs} onObsChange={setObs} />

      <ProductosGrupos productos={productos} cantidades={cantidades} onSetQty={setQty} />

      <ResumenBar totalUnidades={totalUnidades} totalProductos={totalProductos} />

      <button
        onClick={registrar}
        disabled={guardando || totalUnidades === 0}
        style={{
          width: '100%', padding: 14, borderRadius: 10, border: 'none',
          background: totalUnidades === 0 || guardando ? '#94a3b8' : '#0047BA',
          color: '#fff', fontWeight: 700, fontSize: 16,
          cursor: totalUnidades === 0 || guardando ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s'
        }}
      >
        {guardando ? 'Guardando...' : `Guardar Registro — ${fecha} · Turno ${turno}`}
      </button>
    </div>
  )
}
