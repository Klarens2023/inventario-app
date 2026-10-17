import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { prepararPedido, enviarPedido } from '@/lib/cen/pedidoSiesa'
import { siesaConfigurado } from '@/lib/siesa/connekta'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/logistica/ordenes-cen/[id]/pedido — arma el pedido y lo valida contra Siesa sin enviarlo
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado()) {
    return NextResponse.json({ error: 'La API de Siesa no está configurada (faltan SIESA_CLIENT_ID, SIESA_CONNI_KEY y SIESA_CONNI_TOKEN).' }, { status: 503 })
  }
  try {
    return NextResponse.json(await prepararPedido(parseInt(params.id)))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo preparar el pedido' }, { status: 400 })
  }
}

// POST /api/logistica/ordenes-cen/[id]/pedido — crea el pedido en Siesa. Body: { confirmaAlertas: boolean }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado()) {
    return NextResponse.json({ error: 'La API de Siesa no está configurada (faltan SIESA_CLIENT_ID, SIESA_CONNI_KEY y SIESA_CONNI_TOKEN).' }, { status: 503 })
  }
  const { confirmaAlertas } = await req.json().catch(() => ({})) as { confirmaAlertas?: boolean }
  try {
    const r = await enviarPedido(parseInt(params.id), Boolean(confirmaAlertas))
    return NextResponse.json(r, { status: r.ok ? 200 : 422 })
  } catch (e) {
    return NextResponse.json({ ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo enviar el pedido' }, { status: 500 })
  }
}
