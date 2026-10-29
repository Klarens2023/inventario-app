'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CODIGO_2FA_REQUERIDO } from '@/lib/dosPasosConstantes'

export default function LoginPage() {
  const router   = useRouter()
  const [user,   setUser]   = useState('')
  const [pass,   setPass]   = useState('')
  const [error,  setError]  = useState('')
  const [loading, setLoading] = useState(false)
  // Verificación en dos pasos (administradores): al pedir el código aparece el tercer campo
  const [pideCodigo, setPideCodigo] = useState(false)
  const [codigo, setCodigo] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      username: user,
      password: pass,
      // Solo se envía cuando la app lo pidió (administradores con verificación en dos pasos)
      ...(pideCodigo ? { codigo } : {}),
      redirect: false,
    })

    setLoading(false)
    if (res?.ok) { router.push('/dashboard'); return }
    // Contraseña correcta de un administrador: falta el código de su app autenticadora
    if (res?.error === CODIGO_2FA_REQUERIDO) { setPideCodigo(true); return }
    // 'CredentialsSignin' = usuario o contraseña errados. Cualquier otro texto es
    // un mensaje propio de lib/auth.ts (bloqueo por intentos), y se muestra tal cual.
    else setError(res?.error && res.error !== 'CredentialsSignin' ? res.error : 'Usuario o contraseña incorrectos')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px',
      position: 'relative'
    }}>

      {/* Malla de fondo azul suave corporativa */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(0, 71, 186, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 71, 186, 0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>

        {/* 🟦 Logo con Efecto Cristal (Cuadrado y Transparentoso) */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            padding: '20px',
            borderRadius: '8px', // Bordes más cuadrados
            border: '1px solid rgba(255, 255, 255, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            boxShadow: '0 12px 35px rgba(0, 71, 186, 0.15)',
            marginBottom: 20
          }}>
            <Image 
              src="/Klarens-logo.png" 
              alt="Logo Klarens" 
              width={280} 
              height={100} 
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
            Gestión de Operaciones
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4, fontWeight: 600 }}>
            Planta Valledupar
          </p>
        </div>

        {/* 🟦 Formulario de Login Card */}
        <div className="card" style={{ padding: '32px', boxShadow: '0 20px 50px rgba(0, 71, 186, 0.1)' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Usuario
              </label>
              <input
                type="text"
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Ej. juan.perez"
                required
                style={{
                  width: '100%', padding: '14px 16px',
                  background: '#FFFFFF', border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--text)', fontSize: 15,
                  outline: 'none', transition: 'all 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px rgba(0, 71, 186, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '14px 16px',
                  background: '#FFFFFF', border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--text)', fontSize: 15,
                  outline: 'none', transition: 'all 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 4px rgba(0, 71, 186, 0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {pideCodigo && (
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Código de verificación
                </label>
                <input
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  required
                  style={{
                    width: '100%', padding: '14px 16px', background: '#FFFFFF', border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text)', fontSize: 18, letterSpacing: 4, textAlign: 'center', outline: 'none',
                  }}
                />
                <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                  Los 6 dígitos de tu app autenticadora. Sin el celular, usa uno de tus códigos de recuperación (XXXX-XXXX).
                </p>
              </div>
            )}

            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: 10,
                background: '#FEF2F2', border: '1px solid #FCA5A5',
                color: 'var(--danger)', fontSize: 13, fontWeight: 700, textAlign: 'center'
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ 
                width: '100%', 
                padding: '16px', 
                fontSize: '16px', 
                fontWeight: 700,
                borderRadius: '10px',
                marginTop: 10,
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              {loading ? 'Validando credenciales...' : pideCodigo ? 'Verificar e ingresar' : 'Ingresar al Sistema'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
            ¿Problemas con tu acceso? Contacta a Sistemas.
          </span>
        </div>

        {/* Firma */}
        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,71,186,0.1)' }}>
          <p style={{ fontSize: 10.5, color: '#94a3b8', margin: 0, lineHeight: 1.7 }}>
            Desarrollado por el Área de Sistemas<br />
            <strong style={{ color: '#64748b' }}>Luis Alberto Torres</strong> — Asistente de Sistemas<br />
            Lácteos del Cesar SAS · Klarens
          </p>
        </div>
      </div>
    </div>
  )
}
