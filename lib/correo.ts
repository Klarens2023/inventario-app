// Envío de correos desde el servidor por SMTP con la cuenta del departamento (Gmail o Google Workspace).
//
// Variables de entorno (Vercel y .env.local):
//   CORREO_SMTP_USER       cuenta que envía (ej. logistica@empresa.com)
//   CORREO_SMTP_PASSWORD   contraseña de aplicación de esa cuenta (16 letras; requiere verificación en dos pasos)
//   CORREO_SMTP_HOST       opcional, por defecto smtp.gmail.com
//   CORREO_SMTP_PORT       opcional, por defecto 465 (SSL)
//   CORREO_REMITENTE       opcional, nombre que se muestra (por defecto "Logística Klarens")
import nodemailer from 'nodemailer'

export function correoConfigurado(): boolean {
  return Boolean(process.env.CORREO_SMTP_USER && process.env.CORREO_SMTP_PASSWORD)
}

/** "a@x.com, b@y.com; c@z.com" → lista limpia de correos válidos. */
export function listaCorreos(valor: string | undefined): string[] {
  return (valor ?? '').split(/[,;\s]+/).map(s => s.trim()).filter(s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
}

let transporte: nodemailer.Transporter | null = null
function obtenerTransporte(): nodemailer.Transporter {
  const puerto = Number(process.env.CORREO_SMTP_PORT || 465)
  transporte ??= nodemailer.createTransport({
    host: process.env.CORREO_SMTP_HOST || 'smtp.gmail.com',
    port: puerto,
    secure: puerto === 465,
    auth: { user: process.env.CORREO_SMTP_USER, pass: process.env.CORREO_SMTP_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  })
  return transporte
}

export async function enviarCorreo(c: { para: string[]; cc?: string[]; asunto: string; html: string; texto: string }): Promise<void> {
  if (!correoConfigurado()) throw new Error('El correo no está configurado (CORREO_SMTP_USER y CORREO_SMTP_PASSWORD)')
  if (!c.para.length) throw new Error('No hay destinatarios')
  const remitente = process.env.CORREO_REMITENTE || 'Logística Klarens'
  await obtenerTransporte().sendMail({
    from: { name: remitente, address: process.env.CORREO_SMTP_USER! },
    to: c.para, cc: c.cc?.length ? c.cc : undefined,
    subject: c.asunto, html: c.html, text: c.texto,
  })
}
