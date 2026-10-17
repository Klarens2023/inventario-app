import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { recalcularRutas } from '@/lib/cen/rutas'

// POST /api/logistica/ordenes-cen/puntos — homologa un EAN de punto de entrega con
// una sucursal de Siesa (cen_puntos_ean) y asocia todas las órdenes que estaban
// "sin punto" con ese EAN. Las siguientes órdenes de esa tienda ya entran solas.
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const body = await req.json() as { ean?: string; nit?: string; sucursal?: string; razon_social?: string }
  const ean = (body.ean ?? '').trim()
  const nit = (body.nit ?? '').trim()
  const sucursalTxt = (body.sucursal ?? '').trim()
  const sucursal = /^\d+$/.test(sucursalTxt) ? sucursalTxt.padStart(3, '0') : sucursalTxt
  const razon = (body.razon_social ?? '').trim()

  if (!/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: 'EAN inválido' }, { status: 400 })
  if (!nit || nit.length > 15) return NextResponse.json({ error: 'NIT inválido' }, { status: 400 })
  if (!sucursal || sucursal.length > 3) return NextResponse.json({ error: 'Sucursal inválida (máx. 3 caracteres)' }, { status: 400 })
  if (!razon) return NextResponse.json({ error: 'La razón social es obligatoria' }, { status: 400 })

  const [otro] = await sql`SELECT ean FROM cen_puntos_ean WHERE nit = ${nit} AND sucursal = ${sucursal} AND ean <> ${ean}`
  if (otro) {
    return NextResponse.json({ error: `La sucursal ${nit}/${sucursal} ya tiene el EAN ${otro.ean}. Un EAN por sucursal.` }, { status: 409 })
  }

  await sql`
    INSERT INTO cen_puntos_ean (nit, sucursal, razon_social, ean)
    VALUES (${nit}, ${sucursal}, ${razon.slice(0, 100)}, ${ean})
    ON CONFLICT (ean) DO UPDATE
      SET nit = EXCLUDED.nit, sucursal = EXCLUDED.sucursal, razon_social = EXCLUDED.razon_social, activo = TRUE, updated_at = NOW()
  `
  const actualizadas = await sql`
    UPDATE cen_ordenes SET nit = ${nit}, sucursal = ${sucursal}, razon_social = ${razon.slice(0, 100)},
           estado = CASE WHEN estado = 'sin_punto' THEN 'pendiente' ELSE estado END, updated_at = NOW()
    WHERE ean_entrega = ${ean} AND estado IN ('sin_punto', 'pendiente', 'error')
    RETURNING id
  `
  await recalcularRutas()
  return NextResponse.json({ ok: true, ordenesActualizadas: actualizadas.length })
}
