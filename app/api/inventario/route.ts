import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { tieneModulo } from '@/lib/permissions'

function limpiarNum(val: string): number {
  let s = val.replace(/\$|\s/g, '').trim()
  if (!s) return 0
  const hasDot   = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const partes = s.split(',')
    if (partes.length === 2 && partes[1].length <= 2) s = s.replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasDot) {
    const partes = s.split('.')
    if (!(partes.length === 2 && partes[1].length <= 2)) s = s.replace(/\./g, '')
  }
  return isNaN(Number(s)) ? 0 : Number(s)
}

function mapearColumnas(headers: string[]) {
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    const k = h.replace(/^﻿/, '').toLowerCase().trim()
    if (k === 'referencia')                                            map.referencia     = i
    if (['desc. item', 'desc item', 'descripcion'].includes(k))       map.descripcion    = i
    if (['bodega', 'localizacion'].includes(k))                        map.localizacion   = i
    if (k === 'categoria')                                             map.categoria      = i
    if (['sub-grupo', 'subgrupo', 'tipo'].includes(k))                 map.tipo           = i
    if (['existencia', 'cantidad'].includes(k))                        map.cantidad       = i
    if (['u.m.', 'u.m', 'um'].includes(k))                            map.um             = i
    if (k.includes('costo prom. uni') || k.includes('costo unitario')) map.costo_unitario = i
    if (k.includes('costo prom. tot') || k.includes('costo total'))    map.costo_total    = i
    if (k === 'lote')                                                  map.lote           = i
  })
  return map
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get('fecha')
  const tipo  = searchParams.get('tipo')
  const modo  = searchParams.get('modo') || 'items'

  // Sin fecha → devolver fechas disponibles filtradas por modo
  if (!fecha) {
    const fechas = await sql`
      SELECT DISTINCT fecha FROM inventario_datos
      WHERE modo = ${modo}
      ORDER BY fecha DESC LIMIT 30`
    return NextResponse.json(fechas)
  }

  // Verificar si hay filas acumuladas en ese modo+fecha
  const lock = await sql`
    SELECT COUNT(*) AS total FROM inventario_datos
    WHERE fecha = ${fecha} AND modo = ${modo} AND acumulado = true LIMIT 1`
  const bloqueado = Number(lock[0]?.total ?? 0) > 0

  // Filas de esa fecha y ese modo
  let rows
  if (tipo && tipo !== 'todos') {
    rows = await sql`
      SELECT * FROM vista_consulta
      WHERE fecha = ${fecha} AND modo = ${modo} AND tipo = ${tipo}
      ORDER BY referencia`
  } else {
    rows = await sql`
      SELECT * FROM vista_consulta
      WHERE fecha = ${fecha} AND modo = ${modo}
      ORDER BY referencia`
  }

  return NextResponse.json({ rows, bloqueado })
}

// ── POST: cargar TXT ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!tieneModulo(session.user?.rol ?? '', session.user?.modulos, 'cargar')) {
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })
  }

  const formData = await req.formData()
  const file  = formData.get('file') as File
  const dia   = formData.get('dia')  as string
  const modo  = (formData.get('modo') as string) === 'lotes' ? 'lotes' : 'items'

  if (!file || !dia) return NextResponse.json({ error: 'Falta el archivo o el día' }, { status: 400 })

  const hoy    = new Date()
  const diaNum = parseInt(dia, 10)
  if (isNaN(diaNum) || diaNum < 1 || diaNum > 31)
    return NextResponse.json({ error: 'Día inválido' }, { status: 400 })

  const fecha    = new Date(hoy.getFullYear(), hoy.getMonth(), diaNum)
  const fechaStr = fecha.toISOString().split('T')[0]

  let text = await file.text()
  text = text.replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 2) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

  const headers = lines[0].split('\t')
  const cols    = mapearColumnas(headers)

  if (cols.referencia === undefined)
    return NextResponse.json({ error: 'No se encontró la columna Referencia en el TXT' }, { status: 400 })

  if (modo === 'lotes' && cols.lote === undefined)
    return NextResponse.json({ error: 'El archivo no tiene columna Lote. ¿Es realmente un inventario por lotes?' }, { status: 400 })

  // Detectar tipos presentes en el archivo
  const tiposEnArchivo = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t')
    const tipo = fields[cols.tipo]?.trim()
    if (tipo) tiposEnArchivo.add(tipo)
  }

  const userId = session.user?.id ?? null

  // Borrar solo registros del mismo modo + tipo para esa fecha (no afecta el otro modo)
  await sql`DELETE FROM inventario_datos WHERE fecha = ${fechaStr} AND modo = ${modo} AND (tipo = '' OR tipo IS NULL)`
  for (const tipo of Array.from(tiposEnArchivo)) {
    await sql`DELETE FROM inventario_datos WHERE fecha = ${fechaStr} AND modo = ${modo} AND tipo = ${tipo}`
  }

  let insertados = 0
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t')
    if (!fields[cols.referencia]?.trim()) continue

    const loteVal = modo === 'lotes' ? (fields[cols.lote]?.trim() ?? null) : null

    await sql`
      INSERT INTO inventario_datos
        (fecha, categoria, referencia, descripcion, localizacion,
         cantidad, um, costo_unitario, costo_total, tipo, lote, modo, cargado_por)
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
        ${loteVal},
        ${modo},
        ${userId}
      )`
    insertados++
  }

  const tiposStr = Array.from(tiposEnArchivo).join(', ')

  await logAudit({
    usuarioId: userId,
    usuarioNombre: session.user?.name ?? 'Desconocido',
    accion: 'CARGA_INVENTARIO',
    descripcion: `Cargó inventario ${modo} del día ${fechaStr} con ${insertados} registros`,
    datos: { fecha: fechaStr, insertados, tipos: tiposStr, modo, archivo: file.name },
  })

  return NextResponse.json({ ok: true, insertados, fecha: fechaStr, tipos: tiposStr, modo })
}
