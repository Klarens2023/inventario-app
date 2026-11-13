import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { traerInstitucionalesAutomaticos } from '@/lib/cen/pedidosInstitucionales'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/logistica/ordenes-cen/institucional/automatico — busca ya los pedidos PVK de los clientes
// institucionales configurados (lo mismo que hace cada sincronización) y los agrega a su ruta.
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const r = await traerInstitucionalesAutomaticos()
  if (!r.configurado) return NextResponse.json({ error: 'La API real de Siesa no está configurada (SIESA_REAL_CLIENT_ID, SIESA_REAL_CONNI_KEY y SIESA_REAL_CONNI_TOKEN).' }, { status: 503 })
  if (r.error) return NextResponse.json({ error: `No se pudo consultar Siesa: ${r.error}` }, { status: 502 })
  return NextResponse.json({
    ...r,
    mensaje: r.agregados.length
      ? `Se agregaron ${r.agregados.length} pedido(s): ${r.agregados.join(', ')}.`
      : `No hay pedidos nuevos (${r.revisados} pedido(s) de los clientes configurados ya estaban o se quitaron a mano).`,
  })
}
