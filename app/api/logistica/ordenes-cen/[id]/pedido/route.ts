import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { prepararPedido, enviarPedido } from '@/lib/cen/pedidoSiesa'
import { siesaConfigurado } from '@/lib/siesa/connekta'
import { avisarFacturacion } from '@/lib/cen/avisoFacturacion'

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

// POST /api/logistica/ordenes-cen/[id]/pedido — crea el pedido en Siesa y avisa a facturación por correo.
// Body: { confirmaAlertas: boolean, aviso?: boolean }. En el envío en bloque va aviso: false y al final
// se manda un solo correo con todos (POST /api/logistica/ordenes-cen/aviso-facturacion).
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = parseInt(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado()) {
    return NextResponse.json({ error: 'La API de Siesa no está configurada (faltan SIESA_CLIENT_ID, SIESA_CONNI_KEY y SIESA_CONNI_TOKEN).' }, { status: 503 })
  }
  // aviso_modo: 'solo' = el correo lleva solo este pedido; 'ruta' = este más el consolidado de su ruta
  // (todo lo que ya está en Siesa y no se ha avisado). Sin modo: este pedido y los PVK de su relación.
  const { confirmaAlertas, aviso, aviso_modo, totales } = await req.json().catch(() => ({})) as
    { confirmaAlertas?: boolean; aviso?: boolean; aviso_modo?: 'solo' | 'ruta'; totales?: boolean }
  try {
    const r = await enviarPedido(id, Boolean(confirmaAlertas))
    // Quién creó el pedido, para el reporte de control
    if (r.ok) await sql`UPDATE cen_ordenes SET enviado_por = ${acceso.user.name.slice(0, 120)} WHERE id = ${id}`
    // Aviso individual a facturación (si falla, el pedido igual quedó creado; se informa y se puede reintentar)
    let avisoFacturacion = null
    if (r.ok && aviso !== false) {
      const usuario = { id: acceso.user.id, name: acceso.user.name }
      const [o] = aviso_modo === 'ruta' ? await sql`SELECT ruta FROM cen_ordenes WHERE id = ${id}` : []
      avisoFacturacion = o?.ruta
        ? await avisarFacturacion({ ruta: o.ruta as string, totales: totales === true }, usuario)
        : await avisarFacturacion({ ids: [id], soloSeleccion: aviso_modo === 'solo', totales: totales === true }, usuario)
    }
    return NextResponse.json({ ...r, avisoFacturacion }, { status: r.ok ? 200 : 422 })
  } catch (e) {
    return NextResponse.json({ ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo enviar el pedido' }, { status: 500 })
  }
}
