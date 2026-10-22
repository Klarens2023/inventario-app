import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { verificarAcceso } from '@/lib/cen/acceso'
import { sincronizarOrdenes } from '@/lib/cen/sincronizar'

// ssh2 necesita el runtime de Node (no Edge) y la descarga puede tardar.
export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/logistica/ordenes-cen/sincronizar — trae las órdenes nuevas de los SFTP (botón "Traer órdenes")
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const resultados = await sincronizarOrdenes()
  return NextResponse.json(resultados)
}

// GET /api/logistica/ordenes-cen/sincronizar — sincronización programada (GitHub Actions o Vercel Cron).
// Carvajal borra los archivos del SFTP a las ~30-37 h: hay que leerlos con frecuencia o se pierden órdenes.
// No usa sesión: exige el encabezado "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return NextResponse.json({ error: 'CRON_SECRET no está configurado' }, { status: 503 })
  const esperado = Buffer.from(`Bearer ${secreto}`)
  const recibido = Buffer.from(req.headers.get('authorization') ?? '')
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const resultados = await sincronizarOrdenes()
  const resumen = resultados.map(r => ({
    fuente: r.fuente, nuevas: r.nuevas, actualizadas: r.actualizadas, porRevisar: r.porRevisar.length,
    errores: r.errores.length, pendientesPorTraer: r.pendientesPorTraer, error: r.error ?? null,
  }))
  const fallo = resultados.some(r => r.configurada && r.error)
  return NextResponse.json({ ok: !fallo, resumen }, { status: fallo ? 502 : 200 })
}
