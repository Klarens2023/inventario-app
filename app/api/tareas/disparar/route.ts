import { NextRequest, NextResponse } from 'next/server'
import { verificarCron } from '@/lib/cron'

// GET /api/tareas/disparar?workflow=respaldo|alerta — lo llama Vercel Cron (vercel.json).
//
// Por qué existe: en esta cuenta, GitHub descarta casi todas las ejecuciones
// PROGRAMADAS de sus workflows (el 27/10 no corrieron ni el respaldo ni la
// alerta), pero los lanzamientos manuales ("workflow_dispatch") corren siempre
// y al instante. Vercel Cron sí es puntual, así que aquí se usa para lanzar el
// workflow de GitHub por API, igual que el botón "Run workflow".
//
// Requiere GITHUB_DISPATCH_TOKEN en Vercel: token "fine-grained" de la cuenta
// Klarens2023, limitado al repositorio inventario-app y con permiso solo de
// Actions (lectura y escritura). Si se filtra, solo sirve para lanzar workflows.

export const runtime = 'nodejs'

const REPOSITORIO = process.env.GITHUB_DISPATCH_REPO ?? 'Klarens2023/inventario-app'

/** Workflows que se pueden lanzar, con los valores de sus entradas. Nada fuera de esta lista. */
const WORKFLOWS: Record<string, { archivo: string; entradas: () => Record<string, string> }> = {
  respaldo: {
    archivo: 'respaldo-bd.yml',
    // La prueba de restauración solo los domingos (hora de Bogotá); el resto de días, solo la copia
    entradas: () => ({
      probar_restauracion: String(new Date().toLocaleDateString('en-US', { timeZone: 'America/Bogota', weekday: 'short' }) === 'Sun'),
    }),
  },
  alerta: {
    archivo: 'alerta-consumo.yml',
    entradas: () => ({ porcentaje: '50' }),
  },
}

export async function GET(req: NextRequest) {
  const rechazo = verificarCron(req)
  if (rechazo) return rechazo

  const nombre = req.nextUrl.searchParams.get('workflow') ?? ''
  const wf = WORKFLOWS[nombre]
  if (!wf) return NextResponse.json({ error: 'Workflow no permitido' }, { status: 400 })

  const token = process.env.GITHUB_DISPATCH_TOKEN
  if (!token) {
    console.error('[tareas] Falta GITHUB_DISPATCH_TOKEN: no se puede lanzar', nombre)
    return NextResponse.json({ error: 'GITHUB_DISPATCH_TOKEN no está configurado' }, { status: 503 })
  }

  // API de GitHub: lanzar un workflow en la rama main (responde 204 sin cuerpo si lo aceptó)
  const r = await fetch(`https://api.github.com/repos/${REPOSITORIO}/actions/workflows/${wf.archivo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: wf.entradas() }),
  })

  if (r.status !== 204) {
    // El detalle va al log de Vercel; la respuesta no repite nada del token
    console.error(`[tareas] GitHub rechazó lanzar ${nombre}: HTTP ${r.status}`, await r.text().catch(() => ''))
    return NextResponse.json({ ok: false, workflow: nombre, github: r.status }, { status: 502 })
  }
  return NextResponse.json({ ok: true, workflow: nombre })
}
