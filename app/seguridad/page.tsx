'use client'
// Seguridad de mi cuenta: activar la verificación en dos pasos (obligatoria para
// administradores) y regenerar los códigos de recuperación.
// La lógica está en app/api/seguridad/dos-pasos y lib/dosPasos.ts.
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'

type Estado = { habilitado: boolean; obligatoria: boolean; activo: boolean; activadoEn: string | null; codigosRestantes: number }

export default function SeguridadPage() {
  const { data: session, update } = useSession()
  const [estado, setEstado] = useState<Estado | null>(null)
  const [qr, setQr] = useState<{ qr: string; clave: string } | null>(null)
  const [codigo, setCodigo] = useState('')
  const [codigos, setCodigos] = useState<string[] | null>(null) // recién generados: se muestran una sola vez
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const r = await fetch('/api/seguridad/dos-pasos')
    if (r.ok) setEstado(await r.json())
    else setError('No se pudo cargar el estado de tu cuenta')
  }, [])
  useEffect(() => { cargar() }, [cargar])

  /** Llama a la API con una acción; devuelve los datos o deja el error en pantalla. */
  async function accion(cuerpo: Record<string, string>) {
    setOcupado(true); setError('')
    try {
      const r = await fetch('/api/seguridad/dos-pasos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'No se pudo completar'); return null }
      return d
    } finally {
      setOcupado(false)
    }
  }

  async function empezar() {
    const d = await accion({ accion: 'iniciar' })
    if (d) setQr(d)
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    const d = await accion({ accion: 'confirmar', codigo })
    if (d) { setCodigos(d.codigos); setQr(null); setCodigo('') }
  }

  async function regenerar(e: React.FormEvent) {
    e.preventDefault()
    const d = await accion({ accion: 'regenerar', codigo })
    if (d) { setCodigos(d.codigos); setCodigo('') }
  }

  /** Después de guardar los códigos: refresca la sesión (deja de estar restringida) y entra a la app. */
  async function continuar() {
    await update()
    // Navegación completa: el middleware debe leer la cookie ya actualizada (igual que en /cambiar-password)
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0047BA 0%, #002D7A 100%)', padding: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ background: '#f1f5f9', borderRadius: 12, padding: '12px 20px', display: 'inline-block', marginBottom: 14 }}>
            <Image src="/Klarens-logo.png" alt="Logo" width={150} height={52} style={{ objectFit: 'contain' }} priority />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Verificación en dos pasos</h1>
        </div>

        {error && <div style={alerta}>{error}</div>}

        {!estado && !error && <p style={texto}>Cargando…</p>}

        {estado && !estado.habilitado && (
          <p style={texto}>La verificación en dos pasos no está habilitada en el servidor. Avisa al área de Sistemas.</p>
        )}

        {/* ── Códigos de recuperación recién generados (se ven una sola vez) ── */}
        {codigos && (
          <div>
            <p style={texto}><strong>Guarda estos 10 códigos de recuperación</strong> en papel o en tu gestor de contraseñas. Cada uno sirve <strong>una sola vez</strong> para entrar si no tienes el celular. No se volverán a mostrar.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', border: '1px dashed #94a3b8', borderRadius: 10, padding: 14, margin: '14px 0', fontFamily: 'monospace', fontSize: 15, textAlign: 'center' }}>
              {codigos.map(c => <span key={c}>{c}</span>)}
            </div>
            <button onClick={() => navigator.clipboard?.writeText(codigos.join('\n'))} style={{ ...boton, background: '#fff', color: '#0047BA', border: '1px solid #0047BA', marginBottom: 10 }}>Copiar códigos</button>
            <button onClick={continuar} style={boton}>Ya los guardé, continuar</button>
          </div>
        )}

        {/* ── Activación: aún no la tiene ── */}
        {estado?.habilitado && !estado.activo && !codigos && (
          <>
            <p style={texto}>
              Hola <strong>{session?.user?.name}</strong>.{' '}
              {estado.obligatoria ? 'Para entrar como administrador debes activar' : 'Puedes activar'} la verificación en dos pasos: además de la contraseña, al iniciar sesión se pedirá un código de 6 dígitos de una app en tu celular (Google Authenticator, Microsoft Authenticator u otra).
            </p>
            {!qr && <button onClick={empezar} disabled={ocupado} style={boton}>{ocupado ? 'Preparando…' : 'Empezar'}</button>}
            {qr && (
              <form onSubmit={confirmar}>
                {/* Numeración escrita a mano: los estilos globales quitan los números de las listas */}
                <p style={texto}>1. Abre la app autenticadora y elige <strong>Agregar cuenta</strong> → <strong>Escanear código QR</strong>.</p>
                <p style={texto}>2. Escanea este código:</p>
                <div style={{ textAlign: 'center', margin: '8px 0 6px' }}>
                  {/* El QR viene de nuestro servidor como SVG; se muestra como imagen (no como HTML) */}
                  <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr.qr)}`} alt="Código QR para la app autenticadora" width={220} height={220} />
                </div>
                <p style={{ ...texto, fontSize: 12, textAlign: 'center' }}>
                  ¿No puedes escanear? Escribe esta clave en la app:<br />
                  <code style={{ fontSize: 13, letterSpacing: 1, wordBreak: 'break-all' }}>{qr.clave.replace(/(.{4})/g, '$1 ').trim()}</code>
                </p>
                <label style={etiqueta}>3. Escribe el código de 6 dígitos que muestra la app</label>
                <input value={codigo} onChange={e => setCodigo(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={7} required style={campo} />
                <button type="submit" disabled={ocupado} style={{ ...boton, marginTop: 14 }}>{ocupado ? 'Verificando…' : 'Activar'}</button>
              </form>
            )}
          </>
        )}

        {/* ── Ya activa: estado y códigos de recuperación ── */}
        {estado?.habilitado && estado.activo && !codigos && (
          <form onSubmit={regenerar}>
            <p style={texto}>
              ✓ Activa desde el {estado.activadoEn ? new Date(estado.activadoEn).toLocaleDateString('es-CO') : '—'}.
              Te quedan <strong>{estado.codigosRestantes}</strong> códigos de recuperación sin usar.
            </p>
            <p style={{ ...texto, fontSize: 12 }}>Si gastaste varios o los perdiste, genera unos nuevos (los anteriores dejan de servir). Si cambias de celular, pide a otro administrador que te reinicie la verificación en Usuarios.</p>
            <label style={etiqueta}>Código actual de tu app (6 dígitos)</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={7} required style={campo} />
            <button type="submit" disabled={ocupado} style={{ ...boton, marginTop: 14 }}>{ocupado ? 'Generando…' : 'Generar códigos de recuperación nuevos'}</button>
            <a href="/dashboard" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 13, color: '#0047BA' }}>Volver</a>
          </form>
        )}
      </div>
    </div>
  )
}

const texto: React.CSSProperties = { fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 12px' }
const etiqueta: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }
const campo: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 18, letterSpacing: 4, textAlign: 'center', boxSizing: 'border-box' }
const boton: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
const alerta: React.CSSProperties = { background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 14 }
