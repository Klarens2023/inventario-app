'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

// Iconos SVG nítidos
const Icons = {
  Inicio: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Cargar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  Conteo: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>,
  Acumulados: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}

const nav = [
  { href: '/dashboard',  icon: <Icons.Inicio />, label: 'Inicio' },
  { href: '/cargar',     icon: <Icons.Cargar />, label: 'Cargar Inventario' },
  { href: '/consulta',   icon: <Icons.Conteo />, label: 'Conteo Físico' },
  { href: '/acumulados', icon: <Icons.Acumulados />, label: 'Acumulados' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  if (pathname === '/login') return null

  return (
    <aside style={{
      width: 280, height: '100vh', 
      background: 'linear-gradient(180deg, #0047BA 0%, #002D7A 100%)',
      color: '#FFFFFF', display: 'flex', flexDirection: 'column', flexShrink: 0,
      boxShadow: '4px 0 20px rgba(0,0,0,0.15)'
    }}>
      
      {/* SECCIÓN DEL LOGO - EFECTO CRISTAL Y MÁS GRANDE */}
      <div style={{ padding: '30px 20px 20px' }}>
        <div style={{
          // Fondo blanco con 85% de transparencia para el efecto "transparentoso"
          background: 'rgba(255, 255, 255, 0.85)', 
          backdropFilter: 'blur(10px)', // Desenfoca un poco el fondo para que se vea premium
          padding: '12px', 
          borderRadius: '8px', // Más cuadrado (antes era 15px)
          border: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          <Image 
            src="/Klarens-logo.png" // Asegúrate que sea el nuevo PNG sin fondo
            alt="Logo Klarens" 
            width={240} // Aumentamos el tamaño
            height={90} 
            style={{ objectFit: 'contain' }} 
            priority 
          />
        </div>
      </div>

      {/* NAVEGACIÓN */}
      <nav style={{ flex: 1, padding: '10px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 15,
              padding: '14px 18px', borderRadius: '12px', textDecoration: 'none',
              fontSize: '14px', fontWeight: active ? '700' : '500',
              color: active ? '#0047BA' : '#D1E3FF',
              background: active ? '#FFFFFF' : 'transparent',
              transition: 'all 0.3s ease',
              boxShadow: active ? '0 5px 15px rgba(0,0,0,0.2)' : 'none'
            }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* USUARIO */}
      <div style={{ padding: '25px 20px', background: 'rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 15 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{session?.user?.name || 'Usuario'}</div>
          <div style={{ fontSize: 11, color: '#8AB4F8' }}>Planta Valledupar</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ 
            width: '100%', padding: '12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', fontWeight: 600, cursor: 'pointer', transition: '0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#EF4444'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}