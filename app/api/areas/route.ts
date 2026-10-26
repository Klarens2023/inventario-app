import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// GET /api/areas — admin y líder (necesitan la lista para los selectores de usuario)
export async function GET(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['admin', 'lider'] })
  if (!acceso.ok) return acceso.respuesta

  const areas = await sql`SELECT * FROM areas ORDER BY label`
  return NextResponse.json(areas)
}

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// POST /api/areas — crear área nueva (solo admin)
export async function POST(req: NextRequest) {
  const acceso = await exigirAcceso(req, { roles: ['admin'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { label, color, bg, roles_permitidos, modulos_usuario, modulos_lider } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'El nombre del área es obligatorio' }, { status: 400 })

  const key = slugify(label)
  if (!key) return NextResponse.json({ error: 'Nombre de área inválido' }, { status: 400 })

  const existente = await sql`SELECT id FROM areas WHERE key = ${key}`
  if (existente.length > 0) return NextResponse.json({ error: 'Ya existe un área con ese nombre' }, { status: 409 })

  const rolesValidos = ['usuario', 'lider'].filter(r => Array.isArray(roles_permitidos) ? roles_permitidos.includes(r) : true)

  const [nueva] = await sql`
    INSERT INTO areas (key, label, color, bg, roles_permitidos, modulos_usuario, modulos_lider, protegida)
    VALUES (
      ${key}, ${label.trim()},
      ${color || '#1e3a5f'}, ${bg || '#dbeafe'},
      ${rolesValidos.length > 0 ? rolesValidos : ['usuario', 'lider']},
      ${Array.isArray(modulos_usuario) ? modulos_usuario : []},
      ${Array.isArray(modulos_lider) ? modulos_lider : []},
      FALSE
    )
    RETURNING *
  `

  await logAudit({
    usuarioId: user.id,
    usuarioNombre: user.name,
    accion: 'AREA_CREADA',
    descripcion: `Creó el área "${label.trim()}"`,
    datos: { area_key: key, area_label: label.trim() },
  })

  return NextResponse.json(nueva, { status: 201 })
}
