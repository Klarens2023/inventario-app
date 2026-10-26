import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'

// GET /api/sistemas/repuestos/movimientos/[id] — detalle para el comprobante impreso.
// Si el movimiento creó o cerró una asignación, lo indica para imprimir el acta correspondiente.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await exigirAcceso(req, { modulos: ['repuestos_tic'] })
  if (!acceso.ok) return acceso.respuesta

  const id = parseInt(params.id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
  const [row] = await sql`
    SELECT m.id, m.articulo_codigo, m.fecha::text AS fecha, m.tipo, m.motivo, m.cantidad, m.stock_anterior,
           m.stock_resultante, m.equipo_id, m.destino_nombre, m.destino_area, m.proveedor, m.documento_ref,
           m.costo_unitario::float AS costo_unitario, m.contador_paginas, m.observaciones, m.registrado_por,
           a.descripcion, a.tipo AS tipo_articulo, a.categoria, a.marca, a.referencia, a.unidad,
           e.tipo_equipo, e.marca AS equipo_marca, e.modelo AS equipo_modelo, e.numero_serie AS equipo_serie,
           e.area_ubicacion AS equipo_area, e.usuario_asignado AS equipo_usuario,
           (SELECT s.id FROM tic_articulo_asignaciones s WHERE s.movimiento_salida_id = m.id)  AS asignacion_entrega,
           (SELECT s.id FROM tic_articulo_asignaciones s WHERE s.movimiento_retorno_id = m.id) AS asignacion_retorno
    FROM tic_articulo_movimientos m
    JOIN tic_articulos a ON a.codigo = m.articulo_codigo
    LEFT JOIN equipos_tecnologicos e ON e.id = m.equipo_id
    WHERE m.id = ${id}
  `
  if (!row) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
  return NextResponse.json(row)
}
