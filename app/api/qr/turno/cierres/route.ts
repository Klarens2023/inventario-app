import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { tieneModulo } from '@/lib/permissions'
import { aUrlProxy } from '@/lib/google-drive'

function puedeVer(rol: string, modulos: string[]) {
  return rol === 'admin' || tieneModulo(rol, modulos, 'pvn_pagos_qr')
}

// GET /api/qr/turno/cierres — cierres de turno PVV con foto de cierre de
// datafono y número de recogida del cuadre de caja (solo turnos que pasaron
// por ese flujo obligatorio; los turnos PVN no tienen estos datos)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { rol, modulos } = session.user
  if (!puedeVer(rol, modulos ?? [])) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const pvId  = searchParams.get('punto_venta_id')
  const usuarioId = searchParams.get('usuario_id')

  // Sin LIMIT, por la misma razón que /api/qr/pagos: esta consulta alimenta
  // la exportación a Excel y truncar en silencio descartaría cierres del
  // rango filtrado sin avisar.
  // El rango desde/hasta filtra por el día en que el turno se cerró
  // (fecha_cierre), no por el día del turno (fecha): un turno abierto un día
  // y cerrado tarde al siguiente debe aparecer en el reporte de ese cierre.
  // Los turnos cerrados antes de existir fecha_cierre quedan en NULL, así que
  // para esos se usa fecha (el turno) como mejor aproximación disponible.
  const rows = await sql(
    `SELECT id, usuario_id, usuario_nombre, punto_venta_id, punto_venta_nombre,
            fecha::text AS fecha, COALESCE(fecha_cierre, fecha)::text AS fecha_cierre,
            abierto_at, cerrado_at, foto_datafono_url, numero_recogida
     FROM pvn_turnos
     WHERE numero_recogida IS NOT NULL
       AND ($1::date IS NULL OR COALESCE(fecha_cierre, fecha) >= $1::date)
       AND ($2::date IS NULL OR COALESCE(fecha_cierre, fecha) <= $2::date)
       AND ($3::int IS NULL OR punto_venta_id = $3::int)
       AND ($4::int IS NULL OR usuario_id = $4::int)
     ORDER BY cerrado_at DESC`,
    [desde, hasta, pvId ? parseInt(pvId) : null, usuarioId ? parseInt(usuarioId) : null]
  )
  return NextResponse.json(rows.map(r => aUrlProxy(r, req.nextUrl.origin, 'foto_datafono_url')))
}
