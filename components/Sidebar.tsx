'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const nav = [
  { href: '/dashboard',  icon: '🏠', label: 'Inicio' },
  { href: '/cargar',     icon: '📂', label: 'Cargar Inventario' },
  { href: '/consulta',   icon: '📋', label: 'Conteo Fisico' },
  { href: '/acumulados', icon: '📊', label: 'Acumulados' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: 'var(--bg2)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', padding: '20px 0', flexShrink: 0
    }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #3fb950, #238636)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#000', fontSize: 16
          }}>IN</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Inventario</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Control ATER</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 6, textDecoration: 'none',
              fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? 'var(--accent)' : 'var(--text2)',
              background: active ? 'rgba(63,185,80,0.1)' : 'transparent',
              transition: 'all 0.15s'
            }}>
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '16px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 500 }}>
          {session?.user?.name}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn"
          style={{ width: '100%', fontSize: 12, padding: '7px 12px', color: 'var(--text2)' }}
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  )
}