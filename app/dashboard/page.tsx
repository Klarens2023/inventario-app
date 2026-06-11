'use client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

type Card = { href: string; icon: string; title: string; desc: string }

const CARDS_LOGISTICA: Card[] = [
  { href: '/cargar',     icon: '📂', title: 'Cargar Inventario', desc: 'Importa un archivo inv[XX].txt desde tu equipo' },
  { href: '/consulta',   icon: '📋', title: 'Conteo Físico',     desc: 'Registra conteos y observaciones por referencia' },
  { href: '/acumulados', icon: '📊', title: 'Acumulados',        desc: 'Consulta el informe histórico con filtros' },
]

const CARDS_LOGISTICA_LIDER: Card[] = [
  ...CARDS_LOGISTICA,
  { href: '/pvn/historial', icon: '🕐', title: 'Historial PVN',  desc: 'Consulta los registros de ventas de todos los puntos' },
  { href: '/pvn/analisis',  icon: '📈', title: 'Análisis PVN',   desc: 'Consumo de ingredientes y tendencias de venta' },
  { href: '/pvn/catalogo',  icon: '📚', title: 'Catálogo PVN',   desc: 'Gestiona productos y puntos de venta nacionales' },
]

const CARDS_SISTEMAS: Card[] = [
  { href: '/sistemas/equipos', icon: '🖥️', title: 'Equipos TI', desc: 'Administra el inventario de equipos tecnológicos' },
]

const CARDS_PVN: Card[] = [
  { href: '/pvn/registrar', icon: '🛒', title: 'Registrar Ventas', desc: 'Ingresa las ventas del día o turno en tu punto' },
]

const CARDS_ADMIN: Card[] = [
  { href: '/cargar',           icon: '📂', title: 'Cargar Inventario', desc: 'Importa un archivo inv[XX].txt desde tu equipo' },
  { href: '/consulta',         icon: '📋', title: 'Conteo Físico',     desc: 'Registra conteos y observaciones por referencia' },
  { href: '/acumulados',       icon: '📊', title: 'Acumulados',        desc: 'Consulta el informe histórico con filtros' },
  { href: '/pvn/historial',    icon: '🕐', title: 'Historial PVN',     desc: 'Consulta los registros de ventas de todos los puntos' },
  { href: '/pvn/analisis',     icon: '📈', title: 'Análisis PVN',      desc: 'Consumo de ingredientes y tendencias de venta' },
  { href: '/pvn/catalogo',     icon: '📚', title: 'Catálogo PVN',      desc: 'Gestiona productos y puntos de venta nacionales' },
  { href: '/sistemas/equipos', icon: '🖥️', title: 'Equipos TI',       desc: 'Administra el inventario de equipos tecnológicos' },
  { href: '/admin/usuarios',   icon: '👥', title: 'Usuarios',          desc: 'Gestiona cuentas, roles y áreas de acceso' },
  { href: '/auditoria',        icon: '📄', title: 'Auditoría',         desc: 'Registro completo de acciones en el sistema' },
]

const SUBTITLES: Record<string, string> = {
  pvn:     'Registra las ventas de tu punto — ¿qué deseas hacer?',
  admin:   'Panel de administración — ¿qué deseas gestionar?',
  lider:   'Panel del líder — ¿qué deseas revisar?',
  usuario: 'Sistema de control de inventario — ¿qué deseas hacer hoy?',
}

function getCards(rol: string, area: string): Card[] {
  if (rol === 'pvn') return CARDS_PVN
  if (rol === 'admin') return CARDS_ADMIN
  if (area === 'sistemas') return rol === 'lider' ? [...CARDS_SISTEMAS, { href: '/admin/usuarios', icon: '👥', title: 'Usuarios', desc: 'Gestiona cuentas y roles de tu área' }] : CARDS_SISTEMAS
  if (area === 'logistica' || area === 'general') {
    return rol === 'lider' ? CARDS_LOGISTICA_LIDER : CARDS_LOGISTICA
  }
  return CARDS_LOGISTICA
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const rol  = (session?.user as { rol?: string })?.rol ?? 'usuario'
  const area = (session?.user as { area?: string })?.area ?? 'logistica'
  const cards = getCards(rol, area)

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          Bienvenido, {session?.user?.name}
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: 4, fontSize: 14 }}>
          {SUBTITLES[rol] ?? SUBTITLES.usuario}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {cards.map(c => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{c.icon}</div>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{c.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
