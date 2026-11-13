import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { CIUDADES } from '@/lib/cen/institucional'

export const runtime = 'nodejs'

// Clientes institucionales cuyos pedidos PVK se traen solos a una ruta (lib/cen/pedidosInstitucionales.ts).
// Tabla de scripts/migrate-add-cen-institucionales-auto.js.
const SIN_TABLA = 'Falta correr scripts/migrate-add-cen-institucionales-auto.js en la base.'
const sinTabla = (e: unknown) => /cen_clientes_institucionales/.test(String(e)) && /exist/i.test(String(e))

// GET — clientes y catálogo de ciudades
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  try {
    const clientes = await sql`SELECT nit, nombre, ciudades, ruta, activo, updated_at, updated_por FROM cen_clientes_institucionales ORDER BY nombre`
    return NextResponse.json({ clientes, ciudades: CIUDADES })
  } catch (e) {
    if (sinTabla(e)) return NextResponse.json({ clientes: [], ciudades: CIUDADES, error: SIN_TABLA })
    throw e
  }
}

// PUT — crea o actualiza un cliente: { nit, nombre, ciudades: ["08-001"], ruta, activo }
export async function PUT(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const b = await req.json().catch(() => ({})) as { nit?: unknown; nombre?: unknown; ciudades?: unknown; ruta?: unknown; activo?: unknown }
  const nit = String(b.nit ?? '').replace(/\D/g, '')
  const nombre = String(b.nombre ?? '').trim().toUpperCase().slice(0, 160)
  const ruta = String(b.ruta ?? '').trim().toUpperCase().slice(0, 40)
  const ciudades = Array.isArray(b.ciudades) ? Array.from(new Set(b.ciudades.map(String).filter(c => /^\d{2}-\d{3}$/.test(c)))) : []
  if (nit.length < 5 || nit.length > 15) return NextResponse.json({ error: 'NIT inválido' }, { status: 400 })
  if (!nombre) return NextResponse.json({ error: 'Escribe el nombre del cliente' }, { status: 400 })
  if (!ciudades.length) return NextResponse.json({ error: 'Elige al menos una ciudad (código DANE DD-CCC)' }, { status: 400 })
  const [existe] = ruta ? await sql`SELECT ruta FROM cen_rutas WHERE ruta = ${ruta}` : []
  if (!existe) return NextResponse.json({ error: 'Elige una ruta existente' }, { status: 400 })
  try {
    await sql`
      INSERT INTO cen_clientes_institucionales (nit, nombre, ciudades, ruta, activo, updated_at, updated_por)
      VALUES (${nit}, ${nombre}, ${ciudades}::text[], ${ruta}, ${b.activo !== false}, NOW(), ${acceso.user.name.slice(0, 120)})
      ON CONFLICT (nit) DO UPDATE SET nombre = EXCLUDED.nombre, ciudades = EXCLUDED.ciudades, ruta = EXCLUDED.ruta,
        activo = EXCLUDED.activo, updated_at = NOW(), updated_por = EXCLUDED.updated_por`
  } catch (e) {
    if (sinTabla(e)) return NextResponse.json({ error: SIN_TABLA }, { status: 409 })
    throw e
  }
  return NextResponse.json({ ok: true })
}

// DELETE ?nit=... — quita el cliente de la búsqueda automática (los pedidos ya traídos se quedan)
export async function DELETE(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const nit = (req.nextUrl.searchParams.get('nit') ?? '').replace(/\D/g, '')
  if (!nit) return NextResponse.json({ error: 'Indica el NIT' }, { status: 400 })
  await sql`DELETE FROM cen_clientes_institucionales WHERE nit = ${nit}`
  return NextResponse.json({ ok: true })
}
