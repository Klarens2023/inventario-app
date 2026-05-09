import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user?.rol !== 'admin') return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const desde    = searchParams.get('desde')
  const hasta    = searchParams.get('hasta')
  const accion   = searchParams.get('accion')
  const usuarioId = searchParams.get('usuario_id')

  let rows
  if (desde && hasta && accion && accion !== 'todas' && usuarioId) {
    rows = await sql`
      SELECT a.id, a.usuario_nombre, a.accion, a.descripcion, a.datos, a.created_at,
             u.username
      FROM audit_logs a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.created_at >= ${desde}::date
        AND a.created_at <  (${hasta}::date + INTERVAL '1 day')
        AND a.accion = ${accion}
        AND a.usuario_id = ${parseInt(usuarioId)}
      ORDER BY a.created_at DESC
      LIMIT 500`
  } else if (desde && hasta && accion && accion !== 'todas') {
    rows = await sql`
      SELECT a.id, a.usuario_nombre, a.accion, a.descripcion, a.datos, a.created_at,
             u.username
      FROM audit_logs a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.created_at >= ${desde}::date
        AND a.created_at <  (${hasta}::date + INTERVAL '1 day')
        AND a.accion = ${accion}
      ORDER BY a.created_at DESC
      LIMIT 500`
  } else if (desde && hasta && usuarioId) {
    rows = await sql`
      SELECT a.id, a.usuario_nombre, a.accion, a.descripcion, a.datos, a.created_at,
             u.username
      FROM audit_logs a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.created_at >= ${desde}::date
        AND a.created_at <  (${hasta}::date + INTERVAL '1 day')
        AND a.usuario_id = ${parseInt(usuarioId)}
      ORDER BY a.created_at DESC
      LIMIT 500`
  } else if (desde && hasta) {
    rows = await sql`
      SELECT a.id, a.usuario_nombre, a.accion, a.descripcion, a.datos, a.created_at,
             u.username
      FROM audit_logs a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.created_at >= ${desde}::date
        AND a.created_at <  (${hasta}::date + INTERVAL '1 day')
      ORDER BY a.created_at DESC
      LIMIT 500`
  } else {
    rows = await sql`
      SELECT a.id, a.usuario_nombre, a.accion, a.descripcion, a.datos, a.created_at,
             u.username
      FROM audit_logs a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.created_at DESC
      LIMIT 200`
  }

  const usuarios = await sql`SELECT id, nombre, username FROM usuarios ORDER BY nombre`

  return NextResponse.json({ rows, usuarios })
}
