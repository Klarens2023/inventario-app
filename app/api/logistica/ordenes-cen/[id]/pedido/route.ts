import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { prepararPedido, enviarPedido } from '@/lib/cen/pedidoSiesa'
import { siesaConfigurado } from '@/lib/siesa/connekta'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/logistica/ordenes-cen/[id]/pedido — arma el pedido y lo valida contra Siesa sin enviarlo
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = parseInt(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado()) {
    return NextResponse.json({ error: 'La API de Siesa no está configurada (faltan SIESA_CLIENT_ID, SIESA_CONNI_KEY y SIESA_CONNI_TOKEN).' }, { status: 503 })
  }
  try {
    return NextResponse.json(await prepararPedido(id))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo preparar el pedido' }, { status: 400 })
  }
}

// POST /api/logistica/ordenes-cen/[id]/pedido — crea el pedido en Siesa. Body: { confirmaAlertas: boolean }
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = parseInt(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado()) {
    return NextResponse.json({ error: 'La API de Siesa no está configurada (faltan SIESA_CLIENT_ID, SIESA_CONNI_KEY y SIESA_CONNI_TOKEN).' }, { status: 503 })
  }
  const { confirmaAlertas } = await req.json().catch(() => ({})) as { confirmaAlertas?: boolean }
  try {
    const r = await enviarPedido(id, Boolean(confirmaAlertas))
    // Quién creó el pedido, para el reporte de control
    if (r.ok) await sql`UPDATE cen_ordenes SET enviado_por = ${acceso.user.name.slice(0, 120)} WHERE id = ${id}`
    return NextResponse.json(r, { status: r.ok ? 200 : 422 })
  } catch (e) {
    return NextResponse.json({ ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo enviar el pedido' }, { status: 500 })
  }
}
