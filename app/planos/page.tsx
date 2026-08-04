import Link from 'next/link'

const PLANOS = [
  {
    href: '/planos/saldos-iniciales',
    icon: '📒',
    title: 'Saldos Iniciales Contables',
    desc: 'Documento contable, movimiento contable, CxC, CxP y diferidos en un solo plano.',
  },
  {
    href: '/planos/activos-fijos',
    icon: '🏗️',
    title: 'Creación de Activos Fijos',
    desc: 'Alta de activos fijos nuevos con su valoración local y NIIF.',
  },
  {
    href: '/planos/adopcion-niif',
    icon: '📐',
    title: 'Adopción NIIF por Primera Vez',
    desc: 'Carga los valores NIIF de activos ya creados en Siesa.',
  },
  {
    href: '/planos/adiciones-af',
    icon: '➕',
    title: 'Adiciones de Activos Fijos',
    desc: 'Adiciones (mejoras/ampliaciones) a activos fijos ya creados en Siesa.',
  },
  {
    href: '/planos/impuestos-retenciones',
    icon: '🧾',
    title: 'Impuestos y Retenciones',
    desc: 'Configuración de impuestos y retenciones de clientes y proveedores.',
  },
]

export default function PlanosMenuPage() {
  return (
    <div style={{ padding: '32px 40px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Generación de Planos</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        Elige qué plano de ancho fijo para Siesa ERP quieres generar.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {PLANOS.map((p) => (
          <Link key={p.href} href={p.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{p.icon}</div>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{p.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{p.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
