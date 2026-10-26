import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { conReintentoPorDuplicado } from '@/lib/reintentar'
import { CATEGORIAS_VALIDAS, enteroNoNegativo, numeroOpcional, texto, faltaMigracion, MSG_FALTA_MIGRACION } from '@/lib/repuestos'

async function generarCodigo(): Promise<string> {
  const rows = await sql`SELECT codigo FROM tic_articulos ORDER BY codigo DESC LIMIT 1`
  if (rows.length === 0) return 'REP-0001'
  const last = parseInt((rows[0].codigo as string).replace('REP-', ''), 10)
  return `REP-${String(last + 1).padStart(4, '0')}`
}

// GET /api/sistemas/repuestos — catálogo con stock
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['repuestos_tic'] })
  if (!acceso.ok) return acceso.respuesta

  const { searchParams } = new URL(req.url)
  const buscar    = searchParams.get('buscar') ?? ''
  const categoria = searchParams.get('categoria') ?? ''
  const stock     = searchParams.get('stock') ?? ''
  const inactivos = searchParams.get('inactivos') === '1'

  try {
    const like = '%' + buscar + '%'
    const rows = await sql(
      `SELECT codigo, categoria, tipo, descripcion, marca, referencia, compatible_con, unidad,
              stock_actual, stock_minimo, ubicacion, costo_unitario, activo, observaciones,
              actualizado_en
       FROM tic_articulos
       WHERE ($1 = '' OR codigo ILIKE $2 OR descripcion ILIKE $2 OR tipo ILIKE $2
              OR marca ILIKE $2 OR referencia ILIKE $2 OR compatible_con ILIKE $2)
         AND ($3 = '' OR categoria = $3)
         AND ($4 = '' OR ($4 = 'agotado' AND stock_actual = 0)
                      OR ($4 = 'bajo' AND stock_actual <= stock_minimo AND stock_minimo > 0))
         AND ($5 OR activo)
       ORDER BY categoria, tipo, descripcion`,
      [buscar, like, categoria, stock, inactivos]
    )
    return NextResponse.json(rows)
  } catch (e) {
    if (faltaMigracion(e)) return NextResponse.json({ error: MSG_FALTA_MIGRACION, falta_migracion: true }, { status: 503 })
    console.error('[repuestos GET]', e)
    return NextResponse.json({ error: 'Error al consultar artículos' }, { status: 500 })
  }
}

// POST /api/sistemas/repuestos — crear artículo (el stock inicial queda como entrada en el kardex)
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { modulos: ['repuestos_tic'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const body = await req.json()
  const categoria   = texto(body.categoria)
  const tipo        = texto(body.tipo)
  const descripcion = texto(body.descripcion)
  if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
  if (!tipo || !descripcion) return NextResponse.json({ error: 'Tipo y descripción son obligatorios' }, { status: 400 })

  const stockInicial = enteroNoNegativo(body.stock_inicial)
  const stockMinimo  = enteroNoNegativo(body.stock_minimo)
  if (stockInicial === null || stockMinimo === null) {
    return NextResponse.json({ error: 'Stock inicial y mínimo deben ser números enteros sin signo' }, { status: 400 })
  }
  const costo = numeroOpcional(body.costo_unitario)
  const usuario = user.name ?? 'Sistema'
  let codigo = ''

  try {
    // Un solo statement: el artículo y su movimiento de inventario inicial quedan juntos o no queda ninguno
    // El código REP- se recalcula y reintenta si otra alta simultánea tomó el mismo (AUD-21).
    codigo = await conReintentoPorDuplicado(async () => {
      const c = await generarCodigo()
      await sql(
        `WITH art AS (
           INSERT INTO tic_articulos (codigo, categoria, tipo, descripcion, marca, referencia, compatible_con,
                                      unidad, stock_actual, stock_minimo, ubicacion, costo_unitario, observaciones, registrado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::int, $10::int, $11, $12::numeric, $13, $14)
           RETURNING codigo
         )
         INSERT INTO tic_articulo_movimientos (articulo_codigo, fecha, tipo, motivo, cantidad, stock_anterior,
                                               stock_resultante, costo_unitario, registrado_por)
         SELECT codigo, CURRENT_DATE, 'entrada', 'Inventario inicial', $9::int, 0, $9::int, $12::numeric, $14
         FROM art WHERE $9::int > 0`,
        [c, categoria, tipo, descripcion, texto(body.marca), texto(body.referencia), texto(body.compatible_con),
         texto(body.unidad) ?? 'Unidad', stockInicial, stockMinimo, texto(body.ubicacion), costo,
         texto(body.observaciones), usuario]
      )
      return c
    })
  } catch (e) {
    console.error('[repuestos POST]', e)
    return NextResponse.json({ error: 'Error al crear el artículo' }, { status: 500 })
  }

  await logAudit({
    usuarioId: user.id ?? null,
    usuarioNombre: usuario,
    accion: 'TIC_ARTICULO_CREADO',
    descripcion: `Creó artículo ${codigo}: ${descripcion} (${categoria}) con stock inicial ${stockInicial}`,
    datos: { codigo, categoria, tipo, stock_inicial: stockInicial },
  })

  return NextResponse.json({ codigo }, { status: 201 })
}
