import { NextRequest, NextResponse } from 'next/server'
import { verificarCron } from '@/lib/cron'
import { depurarFotosPagos } from '@/lib/depurarFotos'
import { logAudit } from '@/lib/audit'

// GET /api/tareas/depurar-fotos — lo llama Vercel Cron una vez al día (vercel.json).
// Manda a la papelera de Drive las fotos de comprobantes QR de más de 60 días y
// conserva el registro del pago (lib/depurarFotos.ts).
// ?simular=1: solo cuenta lo que se depuraría, sin borrar nada.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const rechazo = verificarCron(req)
  if (rechazo) return rechazo

  const simular = req.nextUrl.searchParams.get('simular') === '1'
  const resultado = await depurarFotosPagos(simular)

  // Queda en la bitácora solo si de verdad se depuró algo
  if (!simular && resultado.enPapelera + resultado.yaNoExistian > 0) {
    await logAudit({
      usuarioId: null, usuarioNombre: 'Sistema', accion: 'FOTOS_DEPURADAS',
      descripcion: `Fotos de pagos de más de 60 días: ${resultado.enPapelera} a la papelera de Drive, ${resultado.yaNoExistian} ya no existían`,
      datos: resultado,
    })
  }
  return NextResponse.json(resultado, { status: resultado.errores ? 207 : 200 })
}
