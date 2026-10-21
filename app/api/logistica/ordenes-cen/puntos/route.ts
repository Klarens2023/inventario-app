import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { recalcularRutas } from '@/lib/cen/rutas'

// POST /api/logistica/ordenes-cen/puntos — homologa un EAN de punto de entrega con
// una sucursal de Siesa (cen_puntos_ean) y asocia todas las órdenes que estaban
// "sin punto" con ese EAN. Las siguientes órdenes de esa tienda ya entran solas.
// Una sucursal puede tener varios EAN (la tienda y el CEDI donde se le entrega); cada EAN, una sola sucursal.
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const body = await req.json() as { ean?: string; nit?: string; sucursal?: string; razon_social?: string; bodega?: string }
  const ean = (body.ean ?? '').trim()
  const nit = (body.nit ?? '').trim()
  const sucursalTxt = (body.sucursal ?? '').trim()
  const sucursal = /^\d+$/.test(sucursalTxt) ? sucursalTxt.padStart(3, '0') : sucursalTxt
  const razon = (body.razon_social ?? '').trim()
  const bodegaTxt = (body.bodega ?? '').trim()
  const bodega = bodegaTxt ? (/^\d+$/.test(bodegaTxt) ? bodegaTxt.padStart(5, '0') : bodegaTxt.toUpperCase()).slice(0, 5) : '00110' // por ahora todas despachan desde 00110 salvo que se escoja otra

  if (!/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: 'EAN inválido' }, { status: 400 })
  if (!nit || nit.length > 15) return NextResponse.json({ error: 'NIT inválido' }, { status: 400 })
  if (!sucursal || sucursal.length > 3) return NextResponse.json({ error: 'Sucursal inválida (máx. 3 caracteres)' }, { status: 400 })
  if (!razon) return NextResponse.json({ error: 'La razón social es obligatoria' }, { status: 400 })

  await sql`
    INSERT INTO cen_puntos_ean (nit, sucursal, razon_social, ean, bodega)
    VALUES (${nit}, ${sucursal}, ${razon.slice(0, 100)}, ${ean}, ${bodega})
    ON CONFLICT (ean) DO UPDATE
      SET nit = EXCLUDED.nit, sucursal = EXCLUDED.sucursal, razon_social = EXCLUDED.razon_social,
          bodega = COALESCE(EXCLUDED.bodega, cen_puntos_ean.bodega), activo = TRUE, updated_at = NOW()
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

// GET /api/logistica/ordenes-cen/puntos — sucursales homologadas (EAN → NIT/sucursal) con ciudad y bodega
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const rows = await sql`
    SELECT p.ean, p.nit, p.sucursal, p.razon_social, p.ciudad, p.bodega,
           (SELECT COUNT(*)::int FROM cen_ordenes o WHERE o.ean_entrega = p.ean) AS ordenes
    FROM cen_puntos_ean p WHERE p.activo = TRUE
    ORDER BY p.nit, p.sucursal
  `
  return NextResponse.json(rows)
}

// PATCH /api/logistica/ordenes-cen/puntos — cambia la bodega de una o varias sucursales (vacía = sin bodega propia).
// Body: { ean, bodega } o { eans: [...], bodega }
export async function PATCH(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const { ean, eans, bodega } = await req.json() as { ean?: string; eans?: string[]; bodega?: string }
  const lista = (Array.isArray(eans) ? eans : [ean]).map(e => String(e ?? '').trim()).filter(Boolean)
  if (!lista.length) return NextResponse.json({ error: 'No se indicó ninguna sucursal' }, { status: 400 })
  const txt = String(bodega ?? '').trim()
  const valor = txt ? (/^\d+$/.test(txt) ? txt.padStart(5, '0') : txt.toUpperCase()) : null
  if (valor && valor.length > 5) return NextResponse.json({ error: 'La bodega tiene máximo 5 caracteres' }, { status: 400 })
  const r = await sql`UPDATE cen_puntos_ean SET bodega = ${valor}, updated_at = NOW() WHERE ean = ANY(${lista}) RETURNING ean`
  if (!r.length) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true, actualizadas: r.length })
}
