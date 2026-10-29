import { NextRequest, NextResponse } from 'next/server'
import { exigirAcceso } from '@/lib/acceso'
import { sql } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { reiniciarDosPasos } from '@/lib/dosPasos'

// DELETE /api/usuarios/[id]/dos-pasos — reinicia la verificación en dos pasos de
// otro administrador (perdió o cambió el celular). Al siguiente ingreso deberá
// activarla de nuevo con un QR nuevo. Solo admin, y nunca sobre sí mismo: si uno
// pierde el celular, entra con un código de recuperación o se lo reinicia otro admin.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await exigirAcceso(req, { roles: ['admin'] })
  if (!acceso.ok) return acceso.respuesta
  const { user } = acceso

  const { id } = await params
  const idNum = Number(id)
  if (!Number.isInteger(idNum) || idNum <= 0) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (String(idNum) === user.id) {
    return NextResponse.json({ error: 'No puedes reiniciar tu propia verificación: pídeselo a otro administrador' }, { status: 403 })
  }

  const [destino] = await sql`SELECT username FROM usuarios WHERE id = ${idNum}`
  if (!destino) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  await reiniciarDosPasos(idNum)
  await logAudit({
    usuarioId: user.id, usuarioNombre: user.name, accion: 'DOS_PASOS_REINICIADO',
    descripcion: `Reinició la verificación en dos pasos de ${destino.username}`, datos: { usuario_id: idNum },
  })
  return NextResponse.json({ ok: true })
}
