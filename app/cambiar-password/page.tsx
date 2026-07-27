'use client'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import Image from 'next/image'

export default function CambiarPasswordPage() {
  const { data: session, update } = useSession()

  const [nueva, setNueva]         = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError]         = useState('')
  const [guardando, setGuardando] = useState(false)
  const [showNueva, setShowNueva]         = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/cambiar-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nueva_password: nueva }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al cambiar la contraseña'); return }

      // Actualizar el token para que el middleware no siga redirigiendo
      await update({ debe_cambiar_password: false })
      // Navegación completa (no router.replace) para que la petición a
      // /dashboard salga garantizado con la cookie de sesión ya actualizada;
      // con navegación suave el middleware a veces alcanzaba a leer la
      // cookie vieja y devolvía otra vez a esta misma pantalla.
      window.location.href = '/dashboard'
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0047BA 0%, #002D7A 100%)'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ background: '#f1f5f9', borderRadius: 12, padding: '12px 20px', display: 'inline-block', marginBottom: 16 }}>
            <Image src="/Klarens-logo.png" alt="Logo" width={160} height={55} style={{ objectFit: 'contain' }} priority />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Cambio de Contraseña
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
            Hola <strong>{session?.user?.name}</strong>, por seguridad debes establecer una nueva contraseña antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '10px 14px', color: '#991b1b', fontSize: 13
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={labelStyle}>Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNueva ? 'text' : 'password'}
                value={nueva}
                onChange={e => setNueva(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowNueva(v => !v)} style={eyeBtn}>
                {showNueva ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Confirmar contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmar ? 'text' : 'password'}
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repite la contraseña"
                required
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowConfirmar(v => !v)} style={eyeBtn}>
                {showConfirmar ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Indicador de coincidencia */}
          {nueva && confirmar && (
            <div style={{ fontSize: 12, fontWeight: 600, color: nueva === confirmar ? '#16a34a' : '#dc2626' }}>
              {nueva === confirmar ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
            </div>
          )}

          <button
            type="submit"
            disabled={guardando}
            style={{
              padding: '12px', borderRadius: 10, border: 'none',
              background: guardando ? '#94a3b8' : '#0047BA',
              color: '#fff', fontWeight: 700, fontSize: 15,
              cursor: guardando ? 'not-allowed' : 'pointer',
              marginTop: 4, transition: 'background 0.2s'
            }}
          >
            {guardando ? 'Guardando...' : 'Guardar y Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b',
  outline: 'none', boxSizing: 'border-box'
}
const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4
}
