import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { exigirAcceso } from '@/lib/acceso'
import { logAudit } from '@/lib/audit'
import {
  dosPasosHabilitado, rolRequiereDosPasos, estadoDosPasos, iniciarActivacion, confirmarActivacion,
  verificarSegundoFactor, regenerarCodigos,
} from '@/lib/dosPasos'
import { CODIGO_2FA_INCORRECTO } from '@/lib/dosPasosConstantes'

// Verificación en dos pasos de la cuenta propia (pantalla /seguridad).
// Solo sesión web (la activación necesita ver el QR). Acepta a un admin que
// aún no la activó: es justamente lo que vino a hacer.
const REGLA = { permitirConfigurar2fa: true } as const

// GET — estado: si aplica a este usuario, si está activa y cuántos códigos de recuperación le quedan
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, REGLA)
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  if (!dosPasosHabilitado()) {
    return NextResponse.json({ habilitado: false, obligatoria: false, activo: false, activadoEn: null, codigosRestantes: 0 })
  }
  const { rol, ...estado } = await estadoDosPasos(Number(user.id))
  // El rol sale de la BD: mientras la verificación está pendiente, la sesión publica el rol vacío
  return NextResponse.json({ habilitado: true, obligatoria: rolRequiereDosPasos(rol), ...estado })
}

// POST { accion: 'iniciar' }                       → QR y clave para la app autenticadora
// POST { accion: 'confirmar', codigo }             → activa y devuelve los 10 códigos de recuperación
// POST { accion: 'regenerar', codigo }             → códigos de recuperación nuevos (pide un código válido)
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, REGLA)
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso
  const id = Number(user.id)

  if (!dosPasosHabilitado()) return NextResponse.json({ error: 'La verificación en dos pasos no está habilitada en el servidor' }, { status: 503 })

  const { accion, codigo } = await req.json().catch(() => ({})) as { accion?: string; codigo?: string }
  const estado = await estadoDosPasos(id)

  if (accion === 'iniciar') {
    // Si ya está activa no se reemplaza desde aquí: para cambiar de celular, otro admin la reinicia
    if (estado.activo) return NextResponse.json({ error: 'Ya tienes la verificación en dos pasos activa' }, { status: 409 })
    const { otpauth, clave } = await iniciarActivacion(id, user.name)
    // El QR se arma en el servidor como SVG: la clave no pasa por ningún servicio externo
    const qr = await QRCode.toString(otpauth, { type: 'svg', margin: 1, width: 220 })
    return NextResponse.json({ qr, clave })
  }

  if (accion === 'confirmar') {
    if (estado.activo) return NextResponse.json({ error: 'Ya tienes la verificación en dos pasos activa' }, { status: 409 })
    const codigos = await confirmarActivacion(id, String(codigo ?? ''))
    if (!codigos) return NextResponse.json({ error: CODIGO_2FA_INCORRECTO }, { status: 400 })
    await logAudit({ usuarioId: user.id, usuarioNombre: user.name, accion: 'DOS_PASOS_ACTIVADO', descripcion: 'Activó la verificación en dos pasos' })
    return NextResponse.json({ codigos })
  }

  if (accion === 'regenerar') {
    if (!estado.activo) return NextResponse.json({ error: 'Primero activa la verificación en dos pasos' }, { status: 409 })
    // Se exige un código válido para que una sesión abierta y desatendida no baste
    if (await verificarSegundoFactor(id, String(codigo ?? '')) !== 'totp') {
      return NextResponse.json({ error: CODIGO_2FA_INCORRECTO }, { status: 400 })
    }
    const codigos = await regenerarCodigos(id)
    await logAudit({ usuarioId: user.id, usuarioNombre: user.name, accion: 'DOS_PASOS_CODIGOS_REGENERADOS', descripcion: 'Generó códigos de recuperación nuevos' })
    return NextResponse.json({ codigos })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
