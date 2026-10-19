import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { consultar, condicion, siesaConfigurado } from '@/lib/siesa/connekta'

export const runtime = 'nodejs'

// GET /api/logistica/ordenes-cen/[id]/cliente — datos del cliente/sucursal de la orden tal como
// están en Siesa (API_v2_Clientes) más lo configurado en la app, para rectificarlos antes del pedido.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const [orden] = await sql`SELECT nit, sucursal, ean_entrega FROM cen_ordenes WHERE id = ${parseInt(params.id)}`
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (!orden.nit) return NextResponse.json({ asociada: false })

  const [punto] = await sql`SELECT bodega, ciudad, departamento FROM cen_puntos_ean WHERE ean = ${orden.ean_entrega}`
  const [config] = await sql`SELECT id_co, tipo_docto, lista_precio, cond_pago, bodega, ind_precio FROM cen_config_clientes WHERE nit = ${orden.nit}`
  const app = { bodega: punto?.bodega ?? null, ciudad: punto?.ciudad ?? null, departamento: punto?.departamento ?? null, config: config ?? null }

  if (!siesaConfigurado()) return NextResponse.json({ asociada: true, app, siesa: null, error: 'La API de Siesa no está configurada.' })
  try {
    const [cli] = await consultar<Record<string, unknown>>('API_v2_Clientes', {
      parametros: `${condicion('f200_nit', orden.nit)} AND ${condicion('f201_id_sucursal', orden.sucursal)}`,
    })
    return NextResponse.json({ asociada: true, app, siesa: cli ?? null })
  } catch (e) {
    return NextResponse.json({ asociada: true, app, siesa: null, error: e instanceof Error ? e.message : 'No se pudo consultar Siesa' })
  }
}
