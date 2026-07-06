'use client'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { MODULOS, type Modulo } from '@/lib/permissions'

type Card = { href: string; icon: string; title: string; desc: string }

const MODULO_CARD: Record<Modulo, Card> = {
  cargar:        { href: '/cargar',           icon: '📂',  title: 'Cargar Inventario', desc: 'Importa un archivo inv[XX].txt desde tu equipo' },
  consulta:      { href: '/consulta',         icon: '📋',  title: 'Conteo Físico',     desc: 'Registra conteos y observaciones por referencia' },
  acumulados:    { href: '/acumulados',       icon: '📊',  title: 'Acumulados',        desc: 'Consulta el informe histórico con filtros' },
  pvn_historial: { href: '/pvn/historial',    icon: '🕐',  title: 'Historial PVN',     desc: 'Consulta los registros de ventas de todos los puntos' },
  pvn_analisis:  { href: '/pvn/analisis',     icon: '📈',  title: 'Análisis PVN',      desc: 'Consumo de ingredientes y tendencias de venta' },
  pvn_catalogo:  { href: '/pvn/catalogo',     icon: '📚',  title: 'Catálogo PVN',      desc: 'Gestiona productos y puntos de venta nacionales' },
  pvn_pagos_qr:  { href: '/pvn/pagos-qr',     icon: '🧾',  title: 'Pagos QR',          desc: 'Revisa los comprobantes de pago QR subidos desde la app móvil' },
  equipos:         { href: '/sistemas/equipos',      icon: '🖥️', title: 'Equipos TI',         desc: 'Administra el inventario de equipos tecnológicos' },
  movimientos_tic: { href: '/sistemas/movimientos', icon: '🔄',  title: 'Movimientos TIC',    desc: 'Registra y consulta movimientos de activos tecnológicos' },
}

const CARD_PVN: Card = { href: '/pvn/registrar', icon: '🛒', title: 'Registrar Ventas', desc: 'Ingresa las ventas del día o turno en tu punto' }
const CARD_USUARIOS: Card = { href: '/admin/usuarios', icon: '👥', title: 'Usuarios', desc: 'Gestiona cuentas y módulos de acceso' }
const CARD_AUDITORIA: Card = { href: '/auditoria', icon: '📄', title: 'Auditoría', desc: 'Registro completo de acciones en el sistema' }

const SUBTITLES: Record<string, string> = {
  pvn:     'Registra las ventas de tu punto — ¿qué deseas hacer?',
  pvv:     'Usa la app móvil para registrar tus pagos QR',
  admin:   'Panel de administración — ¿qué deseas gestionar?',
  lider:   'Panel del líder — ¿qué deseas revisar?',
  usuario: 'Sistema de control de inventario — ¿qué deseas hacer hoy?',
}

function getCards(rol: string, modulos: string[]): Card[] {
  if (rol === 'pvn') return [CARD_PVN]
  if (rol === 'pvv') return []

  const modulosUsuario = rol === 'admin' ? [...MODULOS] : modulos
  const cards = modulosUsuario.map(m => MODULO_CARD[m as Modulo]).filter(Boolean)

  if (rol === 'lider' || rol === 'admin') cards.push(CARD_USUARIOS)
  if (rol === 'admin') cards.push(CARD_AUDITORIA)

  return cards
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const rol     = session?.user?.rol ?? 'usuario'
  const modulos = session?.user?.modulos ?? []
  const cards   = getCards(rol, modulos)

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
      {rol === 'pvv' && (
        <div className="card" style={{ maxWidth: 360, padding: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📱</div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Usa la app móvil</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
            Tu rol solo registra pagos QR desde la aplicación móvil. Descárgala e inicia sesión con tu mismo usuario.
          </p>
        </div>
      )}
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
