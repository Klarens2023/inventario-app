// Autenticación de las tareas programadas (Vercel Cron y GitHub Actions).
//
// Esas llamadas no tienen sesión: traen "Authorization: Bearer <CRON_SECRET>".
// Vercel Cron lo envía solo si la variable CRON_SECRET existe en el proyecto;
// GitHub Actions lo envía desde el secreto del mismo nombre (deben coincidir,
// ver docs/SECRETOS.md).
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Revisa el encabezado de una tarea programada.
 * @returns null si es válido; si no, la respuesta de error lista para devolver
 *          (503 si falta CRON_SECRET en el servidor, 401 si no coincide).
 */
export function verificarCron(req: NextRequest): NextResponse | null {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return NextResponse.json({ error: 'CRON_SECRET no está configurado' }, { status: 503 })
  const esperado = Buffer.from(`Bearer ${secreto}`)
  const recibido = Buffer.from(req.headers.get('authorization') ?? '')
  // Comparación en tiempo constante: no revela por cuánto se equivocó la clave
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  return null
}

/** Quién hizo la llamada programada, según el agente que reporta Vercel Cron. */
export function origenCron(req: NextRequest): 'vercel-cron' | 'github' {
  return (req.headers.get('user-agent') ?? '').startsWith('vercel-cron') ? 'vercel-cron' : 'github'
}
