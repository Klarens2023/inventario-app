import type { NeonQueryPromise } from '@neondatabase/serverless'
import { sql } from '@/lib/db'

// Consultas que se encadenan dentro de sql.transaction(): no se ejecutan hasta que la
// transacción las envía, y si una falla (p. ej. el CHECK stock_actual >= 0) se revierten todas.

export type Query = NeonQueryPromise<false, false>

// Reserva ids de las secuencias para poder enlazar filas entre sí dentro de la misma transacción
export async function reservarIds(): Promise<{ movSalida: number; movRetorno: number; asignacion: number }> {
  const [r] = await sql`
    SELECT nextval(pg_get_serial_sequence('tic_articulo_movimientos', 'id'))::int  AS m1,
           nextval(pg_get_serial_sequence('tic_articulo_movimientos', 'id'))::int  AS m2,
           nextval(pg_get_serial_sequence('tic_articulo_asignaciones', 'id'))::int AS a1
  `
  return { movSalida: r.m1, movRetorno: r.m2, asignacion: r.a1 }
}

type MovStock = {
  id: number
  codigo: string
  tipo: 'entrada' | 'salida'
  cantidad: number          // siempre positiva; el signo lo da el tipo
  fecha: string
  motivo: string
  equipoId: string | null
  destinoNombre: string | null
  destinoArea: string | null
  observaciones: string | null
  usuario: string
  exigirActivo?: boolean    // false para devoluciones: un artículo desactivado igual recibe lo que regresa
  costo?: number | null     // costo a registrar; si no se da, el costo actual del artículo
}

// Mueve el stock y deja el registro en el kardex con el id reservado.
// Si el artículo no existe (o está inactivo y se exige activo) no inserta nada, y la FK que apunta a
// este movimiento hace fallar la transacción.
export function qMovimientoStock(m: MovStock): Query {
  const delta = m.tipo === 'entrada' ? m.cantidad : -m.cantidad
  return sql`
    WITH upd AS (
      UPDATE tic_articulos SET stock_actual = stock_actual + ${delta}::int, actualizado_en = NOW()
      WHERE codigo = ${m.codigo} AND (activo OR NOT ${m.exigirActivo ?? true}::boolean)
      RETURNING codigo, stock_actual, costo_unitario
    )
    INSERT INTO tic_articulo_movimientos (id, articulo_codigo, fecha, tipo, motivo, cantidad, stock_anterior,
                                          stock_resultante, equipo_id, destino_nombre, destino_area,
                                          costo_unitario, observaciones, registrado_por)
    SELECT ${m.id}::int, codigo, ${m.fecha}::date, ${m.tipo}::text, ${m.motivo}::text, ${delta}::int,
           stock_actual - ${delta}::int, stock_actual, ${m.equipoId}::text, ${m.destinoNombre}::text,
           ${m.destinoArea}::text, COALESCE(${m.costo ?? null}::numeric, costo_unitario),
           ${m.observaciones}::text, ${m.usuario}::text
    FROM upd
  `
}

type Cierre = {
  asignacionId: number
  estado: 'devuelto' | 'reemplazado'
  destino: string
  fecha: string
  motivo: string
  detalle: string | null
  reemplazadaPor: number | null
  movRetornoId: number | null
  usuario: string
}

export function qCerrarAsignacion(c: Cierre): Query {
  return sql`
    UPDATE tic_articulo_asignaciones SET
      estado = ${c.estado}, destino_retiro = ${c.destino}, fecha_retiro = ${c.fecha}::date,
      motivo_retiro = ${c.motivo}, detalle_retiro = ${c.detalle},
      reemplazada_por = ${c.reemplazadaPor}::int, movimiento_retorno_id = ${c.movRetornoId}::int,
      cerrado_por = ${c.usuario}, cerrado_en = NOW()
    WHERE id = ${c.asignacionId} AND estado = 'vigente'
  `
}

// Asignación vigente con los datos del artículo, para validar retiros y reemplazos
export async function asignacionVigente(id: number) {
  const [a] = await sql`
    SELECT s.id, s.articulo_codigo, s.cantidad, s.equipo_id, s.persona_nombre, s.persona_area,
           a.descripcion, a.tipo, a.categoria, a.activo, m.costo_unitario AS costo_salida
    FROM tic_articulo_asignaciones s
    JOIN tic_articulos a ON a.codigo = s.articulo_codigo
    JOIN tic_articulo_movimientos m ON m.id = s.movimiento_salida_id
    WHERE s.id = ${id} AND s.estado = 'vigente'
  `
  return a ?? null
}

export function esErrorStock(e: unknown): boolean {
  return String((e as { message?: string })?.message ?? e).includes('stock_actual')
}

export const ETIQUETA_DESTINO: Record<string, string> = {
  inventario: 'regresa al inventario',
  baja: 'se da de baja',
  garantia: 'se envía a garantía',
  perdido: 'perdido / no se recupera',
}
