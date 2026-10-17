import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'

// GET /api/logistica/ordenes-cen/clientes — configuración del pedido por cliente (NIT)
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  return NextResponse.json(await sql`SELECT nit, nombre, id_co, tipo_docto, bodega, ind_precio, lista_precio, cond_pago FROM cen_config_clientes ORDER BY nombre`)
}

// PUT /api/logistica/ordenes-cen/clientes — crea o actualiza la configuración de un cliente
export async function PUT(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const b = await req.json() as Record<string, string | null | undefined>
  const v = (k: string, max: number) => String(b[k] ?? '').trim().toUpperCase().slice(0, max)
  const nit = String(b.nit ?? '').replace(/\D/g, '')
  if (!nit || nit.length > 15) return NextResponse.json({ error: 'NIT inválido' }, { status: 400 })
  const indPrecio = v('ind_precio', 1) || '2'
  if (!['0', '1', '2'].includes(indPrecio)) return NextResponse.json({ error: 'El indicador de precio debe ser 0, 1 o 2' }, { status: 400 })
  const co = v('id_co', 3) || '001', tipo = v('tipo_docto', 3) || 'PVK', bodega = v('bodega', 5) || '00110'
  await sql`
    INSERT INTO cen_config_clientes (nit, nombre, id_co, tipo_docto, bodega, ind_precio, lista_precio, cond_pago)
    VALUES (${nit}, ${String(b.nombre ?? '').trim().slice(0, 80) || null}, ${co}, ${tipo}, ${bodega}, ${indPrecio},
            ${v('lista_precio', 3) || null}, ${v('cond_pago', 3) || null})
    ON CONFLICT (nit) DO UPDATE SET nombre = EXCLUDED.nombre, id_co = EXCLUDED.id_co, tipo_docto = EXCLUDED.tipo_docto,
      bodega = EXCLUDED.bodega, ind_precio = EXCLUDED.ind_precio, lista_precio = EXCLUDED.lista_precio,
      cond_pago = EXCLUDED.cond_pago, updated_at = NOW()
  `
  return NextResponse.json({ ok: true })
}
