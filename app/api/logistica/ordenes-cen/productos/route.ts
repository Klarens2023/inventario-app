import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'

// GET /api/logistica/ordenes-cen/productos — maestro de productos de las órdenes EDI.
// Incluye los EAN que llegaron en órdenes y aún no están en el maestro.
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const rows = await sql`
    SELECT p.ean, p.f120_id, p.item AS codigo_bd, p.descripcion, p.peso_kg::float AS peso_kg, p.und_caja, TRUE AS en_maestro,
           (SELECT COUNT(DISTINCT l.orden_id)::int FROM cen_orden_lineas l WHERE l.ean_item = p.ean) AS ordenes
    FROM cen_productos p
    UNION ALL
    SELECT l.ean_item, NULL, NULL, MAX(l.descripcion), NULL, NULL, FALSE, COUNT(DISTINCT l.orden_id)::int
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
  await sql`
    UPDATE cen_ordenes o SET peso_kg = x.peso, updated_at = NOW()
    FROM (
      SELECT l.orden_id, CASE WHEN BOOL_AND(p.ean IS NOT NULL) THEN SUM(l.cantidad * p.peso_kg) END AS peso
      FROM cen_orden_lineas l LEFT JOIN cen_productos p ON p.ean = l.ean_item
      WHERE l.orden_id IN (SELECT orden_id FROM cen_orden_lineas WHERE ean_item = ${ean})
      GROUP BY l.orden_id
    ) x
    WHERE o.id = x.orden_id AND o.estado <> 'enviado'
  `
  return NextResponse.json({ ok: true })
}
