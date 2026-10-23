import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

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
  const acceso = await exigirAcceso(req, { modulos: ['cargar', 'consulta'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso
  const rol = user.rol ?? ''

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
  const acceso = await exigirAcceso(req, { modulos: ['cargar'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

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

  const userId = user.id ?? null
  const tipos = Array.from(tiposEnArchivo)

  // Integridad: la recarga reemplaza las filas del mismo modo + tipo de esa fecha,
  // y el DELETE arrastra sus conteos (FK ON DELETE CASCADE). Si alguna de esas
  // filas ya fue acumulada (bloqueada), recargar borraría un conteo cerrado que
  // /api/conteo ya no deja modificar: se rechaza en vez de perderlo.
  const [bloqueadas] = await sql`
    SELECT COUNT(*)::int AS n FROM inventario_datos
    WHERE fecha = ${fechaStr} AND modo = ${modo} AND acumulado = true
      AND (tipo = '' OR tipo IS NULL OR tipo = ANY(${tipos}::text[]))
  `
  if (bloqueadas.n > 0) {
    return NextResponse.json(
      { error: `El inventario ${modo} del ${fechaStr} ya tiene ${bloqueadas.n} registro(s) acumulados (bloqueados): no se puede recargar encima.` },
      { status: 409 },
    )
  }

  // Filas del archivo como columnas paralelas, para insertarlas con un solo
  // INSERT ... SELECT FROM unnest (antes era un INSERT por fila: miles de viajes
  // HTTP a Neon y, si uno fallaba a mitad, la fecha quedaba con datos a medias).
  const filas: (string | number | null)[][] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t')
    if (!fields[cols.referencia]?.trim()) continue
    filas.push([
      fields[cols.categoria]?.trim() ?? '',
      fields[cols.referencia].trim(),
      fields[cols.descripcion]?.trim() ?? '',
      fields[cols.localizacion]?.trim() ?? '',
      limpiarNum(fields[cols.cantidad] ?? '0'),
      fields[cols.um]?.trim() ?? '',
      limpiarNum(fields[cols.costo_unitario] ?? '0'),
      limpiarNum(fields[cols.costo_total] ?? '0'),
      fields[cols.tipo]?.trim() ?? '',
      modo === 'lotes' ? (fields[cols.lote]?.trim() ?? null) : null,
    ])
  }
  const col = (j: number) => filas.map(f => f[j])
  const insertados = filas.length

  // Borrar (solo mismo modo + tipos del archivo, no afecta el otro modo) e
  // insertar en una sola transacción: o queda la carga completa o no cambia nada.
  await sql.transaction([
    sql`DELETE FROM inventario_datos
        WHERE fecha = ${fechaStr} AND modo = ${modo}
          AND (tipo = '' OR tipo IS NULL OR tipo = ANY(${tipos}::text[]))`,
    sql`
      INSERT INTO inventario_datos
        (fecha, categoria, referencia, descripcion, localizacion,
         cantidad, um, costo_unitario, costo_total, tipo, lote, modo, cargado_por)
      SELECT ${fechaStr}::date, cat, ref, des, loc, cant, um, cu, ct, tip, lot, ${modo}, ${userId}::int
      FROM unnest(
        ${col(0)}::text[], ${col(1)}::text[], ${col(2)}::text[], ${col(3)}::text[], ${col(4)}::numeric[],
        ${col(5)}::text[], ${col(6)}::numeric[], ${col(7)}::numeric[], ${col(8)}::text[], ${col(9)}::text[]
      ) AS t(cat, ref, des, loc, cant, um, cu, ct, tip, lot)`,
  ])

  const tiposStr = Array.from(tiposEnArchivo).join(', ')

  await logAudit({
    usuarioId: userId,
    usuarioNombre: user.name ?? 'Desconocido',
    accion: 'CARGA_INVENTARIO',
    descripcion: `Cargó inventario ${modo} del día ${fechaStr} con ${insertados} registros`,
    datos: { fecha: fechaStr, insertados, tipos: tiposStr, modo, archivo: file.name },
  })

  return NextResponse.json({ ok: true, insertados, fecha: fechaStr, tipos: tiposStr, modo })
}
