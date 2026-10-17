import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { sincronizarOrdenes } from '@/lib/cen/sincronizar'

// ssh2 necesita el runtime de Node (no Edge) y la descarga puede tardar.
export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/logistica/ordenes-cen/sincronizar — trae las órdenes nuevas de los SFTP
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const resultados = await sincronizarOrdenes()
  return NextResponse.json(resultados)
}
