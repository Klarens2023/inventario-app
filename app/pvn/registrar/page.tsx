'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type Componente = { componente_id: number; componente_nombre: string; cantidad: number; unidad: string }
type Producto   = { id: number; nombre: string; componentes: Componente[] }

const TURNOS = ['Mañana', 'Tarde', 'Noche', 'Cierre']

function limpiarNombre(n: string) {
  return n.replace(/ \(IVA\)$/, '').replace(/ IVA$/, '')
}

function categoria(nombre: string): string {
  const n = nombre.toUpperCase()
  if (n.startsWith('HELADO')) return 'Helados'
  if (n.startsWith('GRANIZADO')) return 'Granizados'
  if (n.includes('SUNDAE')) return 'Sundaes'
  return 'Otros'
}

const CAT_COLORS: Record<string, { border: string; header: string; text: string }> = {
  Helados:    { border: '#bfdbfe', header: '#eff6ff', text: '#1d4ed8' },
  Granizados: { border: '#d1fae5', header: '#f0fdf4', text: '#065f46' },
  Sundaes:    { border: '#ede9fe', header: '#f5f3ff', text: '#7c3aed' },
  Otros:      { border: '#fee2e2', header: '#fff5f5', text: '#b91c1c' },
}

export default function RegistrarVentasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [productos, setProductos] = useState<Producto[]>([])
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [turno, setTurno]           = useState('Cierre')
  const [fecha, setFecha]           = useState(new Date().toISOString().split('T')[0])
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
    fetch('/api/pvn/productos')
      .then(r => r.json())
      .then((data: Producto[]) => {
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
      const res = await fetch('/api/pvn/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, turno, observaciones: obs.trim() || null, detalle }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
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

  const totalUnidades = Object.values(cantidades).reduce((a, b) => a + b, 0)

  const grupos: Record<string, Producto[]> = {}
  productos.forEach(p => {
    const cat = categoria(p.nombre)
    if (!grupos[cat]) grupos[cat] = []
    grupos[cat].push(p)
  })

  return (
    <div style={{ padding: '32px 28px', maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
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

      {/* Datos del turno */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={lbl}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inp} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={lbl}>Turno</label>
          <select value={turno} onChange={e => setTurno(e.target.value)} style={inp}>
            {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={lbl}>Observaciones</label>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional..." style={inp} />
        </div>
      </div>

      {/* Productos agrupados por categoría */}
      {Object.entries(grupos).map(([cat, prods]) => {
        const colors = CAT_COLORS[cat] ?? CAT_COLORS['Otros']
        return (
          <div key={cat} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: 16, border: `1px solid ${colors.border}` }}>
            <div style={{ background: colors.header, padding: '10px 20px', borderBottom: `1px solid ${colors.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</span>
            </div>
            {prods.map(p => {
              const qty = cantidades[p.id] ?? 0
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 20px', borderBottom: '1px solid #f8fafc',
                  background: qty > 0 ? '#f0fdf4' : 'transparent', transition: 'background 0.15s'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: qty > 0 ? 600 : 400, color: '#1e293b' }}>
                      {limpiarNombre(p.nombre)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                      {p.componentes?.length ?? 0} ingredientes
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setQty(p.id, qty - 1)} style={btnCount}>−</button>
                    <input
                      type="number" min={0} value={qty}
                      onChange={e => setQty(p.id, parseInt(e.target.value) || 0)}
                      style={{ width: 54, textAlign: 'center', padding: '6px 4px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 15, fontWeight: 700, color: '#0f172a', outline: 'none' }}
                    />
                    <button onClick={() => setQty(p.id, qty + 1)} style={{ ...btnCount, background: '#0047BA', color: '#fff', border: '1px solid #0047BA' }}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Resumen + botón */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 13, color: '#64748b' }}>Total ingresado: </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{totalUnidades} unidades</span>
          <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 8 }}>
            ({productos.filter(p => (cantidades[p.id] ?? 0) > 0).length} productos)
          </span>
        </div>
      </div>

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

const lbl: React.CSSProperties  = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }
const inp: React.CSSProperties  = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' }
const btnCount: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 700, padding: 0, lineHeight: 1, flexShrink: 0 }
