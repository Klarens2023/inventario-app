'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { GRUPOS_MODULOS, type Modulo } from '@/lib/permissions'

const INACTIVIDAD_MS  = 20 * 60 * 1000
const ADVERTENCIA_MS  = 18 * 60 * 1000

const Icons = {
  Inicio:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Cargar:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  Conteo:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>,
  Acumulados: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Equipos:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Auditoria:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Usuarios:   () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  PVNReg:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/><line x1="9" y1="10" x2="15" y2="10"/></svg>,
  PVNHist:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  PVNAnal:    () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><polyline points="6 14 12 8 18 10"/></svg>,
  PVNCat:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="7" x2="16" y2="7"/><line x1="12" y1="12" x2="16" y2="12"/></svg>,
  PVNPagosQR: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="17.5" y1="14" x2="17.5" y2="17.5"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg>,
  MovTIC:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/><rect x="2" y="4" width="4" height="4" rx="1"/><rect x="18" y="16" width="4" height="4" rx="1"/></svg>,
  Planos:     () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="15" y2="7"/><line x1="8" y1="11" x2="15" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>,
  Conciliacion: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  Collapse:   ({ open }: { open: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.3s', transform: open ? 'rotate(0deg)' : 'rotate(180deg)' }}>
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Logout: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
}

type NavItem = { href: string; icon: React.ReactNode; label: string }

const MODULO_ITEM: Record<Modulo, NavItem> = {
  cargar:        { href: '/cargar',           icon: <Icons.Cargar />,     label: 'Cargar Inventario' },
  consulta:      { href: '/consulta',         icon: <Icons.Conteo />,     label: 'Conteo Físico' },
  acumulados:    { href: '/acumulados',       icon: <Icons.Acumulados />, label: 'Acumulados' },
  pvn_historial: { href: '/pvn/historial',    icon: <Icons.PVNHist />,    label: 'Historial PVN' },
  pvn_analisis:  { href: '/pvn/analisis',     icon: <Icons.PVNAnal />,    label: 'Análisis PVN' },
  pvn_catalogo:  { href: '/pvn/catalogo',     icon: <Icons.PVNCat />,     label: 'Catálogo PVN' },
  pvn_pagos_qr:  { href: '/pvn/pagos-qr',          icon: <Icons.PVNPagosQR />, label: 'Pagos QR' },
  equipos:       { href: '/sistemas/equipos',       icon: <Icons.Equipos />,    label: 'Equipos TI' },
  movimientos_tic: { href: '/sistemas/movimientos', icon: <Icons.MovTIC />,     label: 'Movimientos TIC' },
  planos:        { href: '/planos',           icon: <Icons.Planos />,     label: 'Generación de Planos' },
  conciliacion_facturas: { href: '/contabilidad/conciliacion-facturas', icon: <Icons.Conciliacion />, label: 'Conciliación de Facturas' },
}

export default function Sidebar() {
  const pathname  = usePathname()
  const { data: session } = useSession()
  const [isMobile, setIsMobile] = useState(false)
  const [open, setOpen]         = useState(true)

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [mostrarAviso, setMostrarAviso] = useState(false)
  const [cuenta, setCuenta]     = useState(120)
  const timerLogout  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerAviso   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerCuenta  = useRef<ReturnType<typeof setInterval> | null>(null)

  const rol  = session?.user?.rol ?? 'usuario'
  const modulos = session?.user?.modulos ?? []
  const isAdmin = rol === 'admin'
  const isLider = rol === 'lider' || isAdmin
  const esPvnPvv = rol === 'pvn' || rol === 'pvv'

  const [colapsados, setColapsados] = useState<Record<string, boolean>>({})
  function toggleGrupo(key: string) {
    setColapsados(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // pvn/pvv tienen su propia navegación mínima, no usan el sistema de módulos
  const navPvnPvv: NavItem[] = [
    { href: '/pvn/subir-qr', icon: <Icons.PVNPagosQR />, label: 'Pago QR' },
    ...(rol === 'pvn' ? [{ href: '/pvn/registrar', icon: <Icons.PVNReg />, label: 'Registrar Ventas' }] : []),
  ]

  const gruposVisibles = GRUPOS_MODULOS
    .map(g => ({ ...g, items: g.modulos.filter(m => isAdmin || modulos.includes(m)).map(m => MODULO_ITEM[m]) }))
    .filter(g => g.items.length > 0)

  // Con más de 2 módulos habilitados (p. ej. el admin, que los tiene todos),
  // arrancamos los grupos colapsados para no saturar el menú al ingresar.
  const colapsadosListos = useRef(false)
  useEffect(() => {
    if (colapsadosListos.current || !session) return
    colapsadosListos.current = true
    const totalModulos = gruposVisibles.reduce((s, g) => s + g.items.length, 0)
    if (totalModulos > 2) {
      setColapsados(Object.fromEntries(gruposVisibles.map(g => [g.key, true])))
    }
  }, [session, gruposVisibles])

  const cerrarAvisoYReiniciar = useCallback(() => {
    setMostrarAviso(false)
    setCuenta(120)
    if (timerCuenta.current) clearInterval(timerCuenta.current)
  }, [])

  const iniciarTimers = useCallback(() => {
    // pvn/pvv no se cierran por inactividad, solo cuando expira su sesión
    // (24h) o al tocar "Salir" — pueden pasar buen rato sin tocar la pantalla
    // mientras atienden clientes en el punto de venta.
    if (pathname === '/login' || esPvnPvv) return
    if (timerLogout.current) clearTimeout(timerLogout.current)
    if (timerAviso.current)  clearTimeout(timerAviso.current)
    cerrarAvisoYReiniciar()

    timerAviso.current = setTimeout(() => {
      setMostrarAviso(true)
      setCuenta(120)
      timerCuenta.current = setInterval(() => {
        setCuenta(c => {
          if (c <= 1) { clearInterval(timerCuenta.current!) }
          return c - 1
        })
      }, 1000)
    }, ADVERTENCIA_MS)

    timerLogout.current = setTimeout(() => {
      signOut({ callbackUrl: '/login' })
    }, INACTIVIDAD_MS)
  }, [pathname, esPvnPvv, cerrarAvisoYReiniciar])

  useEffect(() => {
    if (pathname === '/login' || !session || esPvnPvv) return
    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    const onActividad = () => iniciarTimers()
    eventos.forEach(ev => window.addEventListener(ev, onActividad))
    iniciarTimers()
    return () => {
      eventos.forEach(ev => window.removeEventListener(ev, onActividad))
      if (timerLogout.current) clearTimeout(timerLogout.current)
      if (timerAviso.current)  clearTimeout(timerAviso.current)
      if (timerCuenta.current) clearInterval(timerCuenta.current)
    }
  }, [pathname, session, esPvnPvv, iniciarTimers])

  if (pathname === '/login') return null

  const W = open ? 260 : (isMobile ? 0 : 64)

  return (
    <>
      {/* Backdrop en móvil cuando el sidebar está abierto */}
      {isMobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 998 }}
        />
      )}
    <aside style={{
      position: isMobile ? 'fixed' : 'sticky',
      top: 0, left: 0,
      zIndex: isMobile ? 999 : 'auto',
      alignSelf: 'flex-start',
      width: isMobile ? (open ? 260 : 0) : W,
      minWidth: isMobile ? (open ? 260 : 0) : W,
      height: '100vh', flexShrink: 0,
      background: 'linear-gradient(180deg, #0047BA 0%, #002D7A 100%)',
      color: '#fff', display: 'flex', flexDirection: 'column',
      boxShadow: open ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
      transition: 'width 0.3s ease, min-width 0.3s ease',
      overflow: 'hidden'
    }}>

      {/* Logo / Colapsar */}
      <div style={{
        padding: open ? '20px 16px 16px' : '14px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center',
        justifyContent: open ? 'space-between' : 'center',
        minHeight: 80
      }}>
        {open && (
          <div style={{
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
            padding: '8px 12px', borderRadius: 8, flex: 1, marginRight: 10,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}>
            <Image src="/Klarens-logo.png" alt="Logo" width={160} height={55} style={{ objectFit: 'contain' }} priority />
          </div>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          title={open ? 'Colapsar' : 'Expandir'}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', flexShrink: 0, transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          <Icons.Collapse open={open} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: open ? '12px 12px' : '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <NavLink item={{ href: '/dashboard', icon: <Icons.Inicio />, label: 'Inicio' }} pathname={pathname} open={open} onClick={isMobile ? () => setOpen(false) : undefined} />

        {esPvnPvv ? (
          navPvnPvv.map(item => <NavLink key={item.href} item={item} pathname={pathname} open={open} onClick={isMobile ? () => setOpen(false) : undefined} />)
        ) : (
          <>
            {gruposVisibles.map(grupo => (
              <div key={grupo.key} style={{ marginTop: 6 }}>
                {open ? (
                  <button
                    onClick={() => toggleGrupo(grupo.key)}

                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px',
                      color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}
                  >
                    {grupo.label}
                    <span style={{ transition: 'transform 0.2s', transform: colapsados[grupo.key] ? 'rotate(-90deg)' : 'none' }}>▾</span>
                  </button>
                ) : (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '8px 4px' }} />
                )}
                {!colapsados[grupo.key] && grupo.items.map(item => (
                  <NavLink key={item.href} item={item} pathname={pathname} open={open} onClick={isMobile ? () => setOpen(false) : undefined} />
                ))}
              </div>
            ))}

            {isLider && (
              <div style={{ marginTop: 6 }}>
                <NavLink item={{ href: '/admin/usuarios', icon: <Icons.Usuarios />, label: 'Usuarios' }} pathname={pathname} open={open} onClick={isMobile ? () => setOpen(false) : undefined} />
              </div>
            )}
            {isAdmin && (
              <NavLink item={{ href: '/auditoria', icon: <Icons.Auditoria />, label: 'Auditoría' }} pathname={pathname} open={open} onClick={isMobile ? () => setOpen(false) : undefined} />
            )}
          </>
        )}
      </nav>

      {/* Modal inactividad */}
      {mostrarAviso && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '36px 32px', maxWidth: 380, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center'
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏱️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Sesión por expirar
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>
              Por inactividad, tu sesión se cerrará en
            </p>
            <div style={{
              fontSize: 48, fontWeight: 800,
              color: cuenta <= 30 ? '#dc2626' : '#0047BA',
              marginBottom: 24, lineHeight: 1
            }}>
              {String(Math.floor(cuenta / 60)).padStart(2, '0')}:{String(cuenta % 60).padStart(2, '0')}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: '#f8fafc',
                  color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer'
                }}
              >
                Cerrar sesión
              </button>
              <button
                onClick={iniciarTimers}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                  background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer'
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firma desarrollador */}
      {open && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
            Desarrollado por el Área de Sistemas<br />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Luis Alberto Torres</span>
            {' — '}Asistente de Sistemas<br />
            Lácteos del Cesar SAS · Klarens
          </div>
        </div>
      )}

      {/* Usuario */}
      <div style={{
        padding: open ? '16px' : '12px 8px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
        alignItems: open ? 'stretch' : 'center', gap: 10
      }}>
        {open && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{session?.user?.name || 'Usuario'}</div>
            <div style={{ fontSize: 11, color: '#8AB4F8', marginTop: 2 }}>Planta Valledupar</div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={!open ? 'Cerrar sesion' : ''}
          style={{
            width: '100%', padding: open ? '10px' : '10px',
            borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)', color: '#fff',
            fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#EF4444'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          <Icons.Logout />
          {open && 'Cerrar Sesion'}
        </button>
      </div>
    </aside>

      {/* Botón hamburguesa flotante en móvil cuando sidebar está cerrado */}
      {isMobile && !open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 997,
            background: '#0047BA', border: 'none', borderRadius: 10,
            width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,71,186,0.4)', color: '#fff',
          }}
          title="Menú"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}
    </>
  )
}

function NavLink({ item, pathname, open, onClick }: { item: NavItem; pathname: string; open: boolean; onClick?: () => void }) {
  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  return (
    <Link href={item.href}
      title={!open ? item.label : ''}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        gap: open ? 12 : 0,
        justifyContent: open ? 'flex-start' : 'center',
        padding: open ? '12px 16px' : '12px',
        borderRadius: 10, textDecoration: 'none',
        fontSize: 14, fontWeight: active ? 700 : 500,
        color: active ? '#0047BA' : '#D1E3FF',
        background: active ? '#fff' : 'transparent',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap', overflow: 'hidden',
        boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
      {open && <span style={{ opacity: 1, transition: 'opacity 0.2s' }}>{item.label}</span>}
    </Link>
  )
}
