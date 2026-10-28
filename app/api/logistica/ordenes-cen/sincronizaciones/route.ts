import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { ultimasSincronizaciones } from '@/lib/cen/registroSincronizacion'

// GET /api/logistica/ordenes-cen/sincronizaciones — últimas 10 sincronizaciones de
// órdenes EDI (programadas y manuales), para "Última sincronización" en la pantalla.
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  return NextResponse.json(await ultimasSincronizaciones(10))
}
