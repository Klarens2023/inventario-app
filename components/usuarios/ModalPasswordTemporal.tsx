'use client'
import { useState } from 'react'
import { btnPrimary, btnSecondary } from './constants'

type Props = {
  nombre: string
  username: string
  password: string
  /** 'creado' tras crear el usuario, 'restablecido' tras restablecer su contraseña */
  motivo: 'creado' | 'restablecido'
  onClose: () => void
}

// Muestra UNA sola vez la contraseña temporal que devolvió la API (AUD-03): no
// se guarda en ningún lado del navegador; al cerrar este modal ya no se puede
// volver a ver y, si se pierde, hay que restablecerla de nuevo.
export function ModalPasswordTemporal({ nombre, username, password, motivo, onClose }: Props) {
  const [copiada, setCopiada] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password)
      setCopiada(true)
    } catch {
      // Sin permiso de portapapeles (http, navegador antiguo): se copia a mano
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 0, marginBottom: 4 }}>
          {motivo === 'creado' ? 'Usuario creado' : 'Contraseña restablecida'}
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          Entrega esta contraseña temporal a <strong>{nombre}</strong> (usuario <strong>{username}</strong>).
          Deberá cambiarla al iniciar sesión.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <code style={{
            flex: 1, padding: '12px 14px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0',
            fontSize: 20, fontWeight: 700, letterSpacing: 2, color: '#0f172a', textAlign: 'center', userSelect: 'all',
          }}>
            {password}
          </code>
          <button onClick={copiar} style={btnSecondary}>{copiada ? 'Copiada' : 'Copiar'}</button>
        </div>
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', color: '#92400e', fontSize: 12, marginBottom: 24 }}>
          Solo se muestra esta vez. Si se pierde, restablécela de nuevo desde Editar usuario.
        </div>
        <button onClick={onClose} style={{ ...btnPrimary, width: '100%' }}>Ya la anoté</button>
      </div>
    </div>
  )
}
