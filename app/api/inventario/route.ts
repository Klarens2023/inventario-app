import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

function limpiarNum(val: string): number {
  const s = val.replace(/\$|,/g, '').trim()
  return isNaN(Number(s)) ? 0 : Number(s)
}

function mapearColumnas(headers: string[]) {
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    const k = h.replace(/^\uFEFF/, '').toLowerCase().trim()
    if (k === 'referencia')                                          map.referencia     = i
    if (['desc. item', 'desc item', 'descripcion'].includes(k))     map.descripcion    = i
    if (['bodega', 'localizacion'].includes(k))                      map.localizacion   = i
    if (k === 'categoria')                                           map.categoria      = i
    if (['sub-grupo', 'subgrupo', 'tipo'].includes(k))               map.tipo           = i
    if (['existencia', 'cantidad'].includes(k))                      map.cantidad       = i
    if (['u.m.', 'u.m', 'um'].includes(k))                          map.um             = i
    if (k.includes('costo prom. uni') || k.includes('costo unitario')) map.costo_unitario = i
    if (k.includes('costo prom. tot') || k.includes('costo total'))    map.costo_total    = i
  })
  return map
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fecha    = searchParams.get('fecha')
  const tipo     = searchParams.get('tipo')

  // Sin fecha → devolver fechas y tipos disponibles
  if (!fecha) {
    const fechas = await sql`SELECT DISTINCT fecha FROM inventario_datos ORDER BY fecha DESC LIMIT 30`
    return NextResponse.json(fechas)
  }

  // Con fecha → devolver filas (con filtro de tipo opcional)
  let rows
  if (tipo && tipo !== 'todos') {
    rows = await sql`
      SELECT * FROM vista_consulta 
      WHERE fecha = ${fecha} AND tipo = ${tipo}
      ORDER BY referencia`
  } else {
    rows = await sql`
      SELECT * FROM vista_consulta 
      WHERE fecha = ${fecha}
      ORDER BY referencia`
  }

  return NextResponse.json(rows)
}

// ── GET tipos disponibles para una fecha ─────────────────────────────────────
// Llamado como /api/inventario/tipos?fecha=YYYY-MM-DD
// (se maneja en route separada abajo)

// ── POST: cargar TXT ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file     = formData.get('file') as File
  const dia      = formData.get('dia')  as string

  if (!file || !dia) return NextResponse.json({ error: 'Falta el archivo o el día' }, { status: 400 })

  const hoy    = new Date()
  const diaNum = parseInt(dia, 10)
  if (isNaN(diaNum) || diaNum < 1 || diaNum > 31)
    return NextResponse.json({ error: 'Día inválido' }, { status: 400 })

  const fecha    = new Date(hoy.getFullYear(), hoy.getMonth(), diaNum)
  const fechaStr = fecha.toISOString().split('T')[0]

  let text = await file.text()
  text = text.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')

  if (lines.length < 2) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

  const headers = lines[0].split('\t')
  const cols    = mapearColumnas(headers)

  if (cols.referencia === undefined)
    return NextResponse.json({ error: 'No se encontró la columna Referencia en el TXT' }, { status: 400 })

  // ── Detectar los TIPOS presentes en este archivo ──────────────────────────
  // Así solo borramos registros del mismo tipo, no los de otro sub-grupo
  const tiposEnArchivo = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t')
    const tipo = fields[cols.tipo]?.trim()
    if (tipo) tiposEnArchivo.add(tipo)
  }

  const userId = session.user?.id ?? null
  
  // Borrar solo los registros de esa fecha Y esos tipos (no afecta otros sub-grupos)
  // Si el archivo no tiene columna tipo, limpiar registros sin tipo para evitar duplicados
  await sql`DELETE FROM inventario_datos WHERE fecha = ${fechaStr} AND (tipo = '' OR tipo IS NULL)`
  for (const tipo of Array.from(tiposEnArchivo)) {
    await sql`DELETE FROM inventario_datos WHERE fecha = ${fechaStr} AND tipo = ${tipo}`
  }

  let insertados = 0
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t')
    if (!fields[cols.referencia]?.trim()) continue

    await sql`
      INSERT INTO inventario_datos
        (fecha, categoria, referencia, descripcion, localizacion,
         cantidad, um, costo_unitario, costo_total, tipo, cargado_por)
      VALUES (
        ${fechaStr},
        ${fields[cols.categoria]?.trim() ?? ''},
        ${fields[cols.referencia].trim()},
        ${fields[cols.descripcion]?.trim() ?? ''},
        ${fields[cols.localizacion]?.trim() ?? ''},
        ${limpiarNum(fields[cols.cantidad] ?? '0')},
        ${fields[cols.um]?.trim() ?? ''},
        ${limpiarNum(fields[cols.costo_unitario] ?? '0')},
        ${limpiarNum(fields[cols.costo_total] ?? '0')},
        ${fields[cols.tipo]?.trim() ?? ''},
        ${userId}
      )`
    insertados++
  }

  const tiposStr = Array.from(tiposEnArchivo).join(', ')
  return NextResponse.json({ ok: true, insertados, fecha: fechaStr, tipos: tiposStr })
}