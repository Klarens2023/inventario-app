import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { asignarItemProducto, recalcularPesoOrdenes } from '@/lib/cen/productos'

// GET /api/logistica/ordenes-cen/productos — maestro de productos de las órdenes EDI.
// Incluye los EAN que llegaron en órdenes y aún no están en el maestro.
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const rows = await sql`
    SELECT p.ean, p.f120_id, p.item AS codigo_bd, p.descripcion, p.peso_kg::float AS peso_kg, p.und_caja, TRUE AS en_maestro,
           (SELECT COUNT(DISTINCT l.orden_id)::int FROM cen_orden_lineas l WHERE l.ean_item = p.ean) AS ordenes,
           (SELECT i.descripcion FROM cen_items_siesa i WHERE i.f120_id = p.f120_id) AS descripcion_siesa
    FROM cen_productos p
    UNION ALL
    SELECT l.ean_item, NULL, NULL, MAX(l.descripcion), NULL, NULL, FALSE, COUNT(DISTINCT l.orden_id)::int, NULL
    FROM cen_orden_lineas l
    WHERE NOT EXISTS (SELECT 1 FROM cen_productos p WHERE p.ean = l.ean_item)
    GROUP BY l.ean_item
    ORDER BY 7, 2 NULLS FIRST, 4
  `
  return NextResponse.json(rows)
}

// PUT /api/logistica/ordenes-cen/productos — crea o actualiza un producto (ítem de Siesa, peso, und/caja)
export async function PUT(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const b = await req.json() as { ean?: string; f120_id?: string | number | null; descripcion?: string; peso_kg?: string | number | null; und_caja?: string | number | null }
  const ean = String(b.ean ?? '').trim()
  if (!/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: 'EAN inválido' }, { status: 400 })
  const entero = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? null : Number(v))
  const f120 = entero(b.f120_id), und = entero(b.und_caja)
  const peso = b.peso_kg === null || b.peso_kg === undefined || String(b.peso_kg).trim() === '' ? 0 : Number(String(b.peso_kg).replace(',', '.'))
  if (f120 !== null && (!Number.isInteger(f120) || f120 <= 0)) return NextResponse.json({ error: 'El ítem de Siesa debe ser un número entero' }, { status: 400 })
  if (!Number.isFinite(peso) || peso < 0) return NextResponse.json({ error: 'Peso inválido' }, { status: 400 })
  if (und !== null && (!Number.isInteger(und) || und <= 0)) return NextResponse.json({ error: 'Unidades por caja inválidas' }, { status: 400 })

  await sql`
    INSERT INTO cen_productos (ean, f120_id, descripcion, peso_kg, und_caja)
    VALUES (${ean}, ${f120}, ${String(b.descripcion ?? '').trim().slice(0, 200) || null}, ${peso}, ${und})
    ON CONFLICT (ean) DO UPDATE SET f120_id = EXCLUDED.f120_id, descripcion = COALESCE(EXCLUDED.descripcion, cen_productos.descripcion),
      peso_kg = EXCLUDED.peso_kg, und_caja = EXCLUDED.und_caja, updated_at = NOW()
  `
  // El peso de las órdenes abiertas con ese producto se recalcula (queda vacío si algún producto no tiene peso).
  await recalcularPesoOrdenes(ean)
  return NextResponse.json({ ok: true })
}

// POST /api/logistica/ordenes-cen/productos — asigna solo el ítem de Siesa (y el peso, si se envía) a un
// código de barras, desde la vista previa del pedido de una orden. Body: { ean, f120_id, peso_kg? }.
// Queda en el maestro: las siguientes órdenes con ese código ya traen el ítem.
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const b = await req.json().catch(() => ({})) as { ean?: string; f120_id?: string | number; peso_kg?: string | number | null }
  const ean = String(b.ean ?? '').trim()
  if (!/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: 'EAN inválido' }, { status: 400 })
  const f120 = Number(b.f120_id)
  if (!Number.isInteger(f120) || f120 <= 0) return NextResponse.json({ error: 'Elige el ítem de Siesa' }, { status: 400 })
  const textoPeso = b.peso_kg === null || b.peso_kg === undefined ? '' : String(b.peso_kg).trim().replace(',', '.')
  const peso = textoPeso === '' ? null : Number(textoPeso)
  if (peso !== null && (!Number.isFinite(peso) || peso < 0)) return NextResponse.json({ error: 'Peso inválido' }, { status: 400 })

  const [item] = await sql`SELECT unidad, descripcion FROM cen_items_siesa WHERE f120_id = ${f120}`
  if (!item) return NextResponse.json({ error: `El ítem ${f120} no está en la lista de ítems de Siesa` }, { status: 400 })
  // Un ítem que Siesa maneja por kilo necesita el peso por unidad para convertir las órdenes en unidades
  if (String(item.unidad).trim().toUpperCase() === 'KG' && !(peso && peso > 0)) {
    const [actual] = await sql`SELECT peso_kg::float AS peso FROM cen_productos WHERE ean = ${ean}`
    if (!(Number(actual?.peso) > 0)) {
      return NextResponse.json({ error: `Siesa maneja el ítem ${f120} (${item.descripcion}) por kilo: escribe el peso por unidad en kg (ej. 2.5 para una barra de 2,5 kg).` }, { status: 400 })
    }
  }
  await asignarItemProducto(ean, f120, peso)
  return NextResponse.json({ ok: true })
}
