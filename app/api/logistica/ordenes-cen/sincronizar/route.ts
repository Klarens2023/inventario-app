import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { verificarCron, origenCron } from '@/lib/cron'
import { sincronizarOrdenes, type ResultadoFuente } from '@/lib/cen/sincronizar'
import { registrarSincronizacion, type OrigenSincronizacion } from '@/lib/cen/registroSincronizacion'

// ssh2 necesita el runtime de Node (no Edge) y la descarga puede tardar.
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Corre la sincronización y la deja registrada (quién la lanzó, cuándo y si
 * funcionó) aunque falle; el error se vuelve a lanzar para que la ruta responda 500.
 */
async function sincronizarYRegistrar(origen: OrigenSincronizacion, usuario?: string): Promise<ResultadoFuente[]> {
  const inicio = new Date()
  try {
    const resultados = await sincronizarOrdenes()
    await registrarSincronizacion({ origen, inicio, resultados, usuario })
    return resultados
  } catch (e) {
    await registrarSincronizacion({ origen, inicio, error: (e as Error).message, usuario })
    throw e
  }
}

// POST /api/logistica/ordenes-cen/sincronizar — trae las órdenes nuevas de los SFTP (botón "Traer órdenes")
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const resultados = await sincronizarYRegistrar('manual', acceso.user.name)
  return NextResponse.json(resultados)
}

// GET /api/logistica/ordenes-cen/sincronizar — sincronización programada (Vercel Cron o GitHub Actions).
// Carvajal borra los archivos del SFTP a las ~30-37 h: hay que leerlos con frecuencia o se pierden órdenes.
// No usa sesión: exige el encabezado "Authorization: Bearer <CRON_SECRET>" (ver lib/cron.ts).
export async function GET(req: NextRequest) {
  const rechazo = verificarCron(req)
  if (rechazo) return rechazo

  const resultados = await sincronizarYRegistrar(origenCron(req))
  const resumen = resultados.map(r => ({
    fuente: r.fuente, nuevas: r.nuevas, actualizadas: r.actualizadas, porRevisar: r.porRevisar.length,
    errores: r.errores.length, pendientesPorTraer: r.pendientesPorTraer, error: r.error ?? null,
  }))
  const fallo = resultados.some(r => r.configurada && r.error)
  return NextResponse.json({ ok: !fallo, resumen }, { status: fallo ? 502 : 200 })
}
