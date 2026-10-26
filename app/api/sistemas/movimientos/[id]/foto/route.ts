import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { subirADrive, aUrlProxy, limpiarNombreArchivo, comprimirImagen } from '@/lib/google-drive'

const MAX_BYTES = 8 * 1024 * 1024

// POST /api/sistemas/movimientos/[id]/foto — sube la foto del formato ya
// firmado y autorizado. Usa getAuthUser (no getServerSession) para que tanto
// la sesión web como el JWT de la app móvil puedan subir la foto.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const acceso = await exigirAcceso(req, { modulos: ['movimientos_tic'], movil: true })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const [mov] = await sql`SELECT id FROM tic_movimientos WHERE id = ${params.id}`
  if (!mov) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })

  const form = await req.formData()
  const foto = form.get('foto') as File | null
  if (!foto) return NextResponse.json({ error: 'La foto es obligatoria' }, { status: 400 })
  if (!foto.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
  }
  if (foto.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen es muy pesada (máx 8MB)' }, { status: 413 })
  }

  const nombreArchivo = `${params.id}_autorizacion_${Date.now()}_${limpiarNombreArchivo(user.name)}.jpg`
  const fotoUrl = await subirADrive(await comprimirImagen(foto), nombreArchivo)

  await sql`UPDATE tic_movimientos SET foto_autorizacion_url = ${fotoUrl} WHERE id = ${params.id}`

  await logAudit({
    usuarioId: user.id,
    usuarioNombre: user.name,
    accion: 'TIC_MOVIMIENTO_FOTO_SUBIDA',
    descripcion: `Subió foto de autorización firmada del movimiento ${params.id}`,
    datos: { id: params.id },
  })

  return NextResponse.json(aUrlProxy({ foto_autorizacion_url: fotoUrl }, req.nextUrl.origin, 'foto_autorizacion_url'))
}
