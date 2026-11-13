import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { consultar, condicion, siesaConfigurado } from '@/lib/siesa/connekta'

export const runtime = 'nodejs'

// GET /api/logistica/ordenes-cen/[id]/cliente — datos del cliente/sucursal de la orden tal como
// están en Siesa (API_v2_Clientes) más lo configurado en la app, para rectificarlos antes del pedido.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const id = parseInt(params.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const [orden] = await sql`SELECT nit, sucursal, ean_entrega FROM cen_ordenes WHERE id = ${id}`
  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (!orden.nit) return NextResponse.json({ asociada: false })

  const [punto] = await sql`SELECT bodega, ciudad, departamento FROM cen_puntos_ean WHERE ean = ${orden.ean_entrega}`
  const [config] = await sql`SELECT id_co, tipo_docto, lista_precio, cond_pago, bodega, ind_precio FROM cen_config_clientes WHERE nit = ${orden.nit}`
  // Dirección y ciudad de la sucursal (base importada de Siesa) y los EAN que el sistema tiene asociados a
  // esa sucursal, para comparar con el EAN del punto de entrega de la orden.
  const [direccion] = await sql`SELECT direccion, ciudad, departamento FROM cen_sucursales_siesa WHERE nit = ${orden.nit} AND sucursal = ${orden.sucursal}`
    .catch(() => [] as Record<string, unknown>[])
  const eans = await sql`SELECT ean FROM cen_puntos_ean WHERE nit = ${orden.nit} AND sucursal = ${orden.sucursal} AND activo ORDER BY ean`
  const app = {
    bodega: punto?.bodega ?? null, config: config ?? null,
    direccion: (direccion?.direccion as string | null) ?? null,
    ciudad: (direccion?.ciudad as string | null) ?? punto?.ciudad ?? null,
    departamento: (direccion?.departamento as string | null) ?? punto?.departamento ?? null,
    ean_orden: orden.ean_entrega as string,
    eans: eans.map(e => e.ean as string),
  }

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
