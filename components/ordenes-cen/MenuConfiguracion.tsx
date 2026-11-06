'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// Páginas de reglas y configuración del módulo de órdenes EDI, agrupadas en un solo botón
// para dejar a la vista solo lo de uso diario.
const OPCIONES = [
  { href: '/logistica/ordenes-cen/reglas', titulo: 'Reglas de ruta', detalle: 'Qué ruta toma cada punto y días de tránsito' },
  { href: '/logistica/ordenes-cen/sucursales', titulo: 'Sucursales', detalle: 'Puntos de entrega (EAN) y su sucursal de Siesa' },
  { href: '/logistica/ordenes-cen/productos', titulo: 'Productos', detalle: 'Maestro: ítem de Siesa, peso y unidades por caja' },
  { href: '/logistica/ordenes-cen/clientes', titulo: 'Clientes', detalle: 'CO, lista de precios, bodega y condición de pago' },
]

export function MenuConfiguracion() {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Se cierra con clic afuera o con Escape
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', escape) }
  }, [abierto])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn" onClick={() => setAbierto(a => !a)} aria-haspopup="menu" aria-expanded={abierto}>
        ⚙ Configuración <span style={{ fontSize: 10, marginLeft: 2 }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div role="menu" className="card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 300, maxWidth: 'calc(100vw - 32px)', padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
          {OPCIONES.map(o => (
            <Link key={o.href} href={o.href} role="menuitem" onClick={() => setAbierto(false)} className="cen-menu-opcion"
              style={{ display: 'block', padding: '8px 10px', borderRadius: 6, textDecoration: 'none', color: 'var(--text)' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{o.titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{o.detalle}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
