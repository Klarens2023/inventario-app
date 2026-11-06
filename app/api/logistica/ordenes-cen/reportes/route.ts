import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { datosReportes, datosSincronizacion } from '@/lib/cen/reportesDatos'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

// GET /api/logistica/ordenes-cen/reportes — datos de los reportes de órdenes EDI.
//   tipo=datos (por defecto): órdenes y líneas del periodo; los reportes se arman con lib/cen/reportes.ts
//     desde, hasta (AAAA-MM-DD), campo=entrega|orden (fecha que filtra), cadena (EAN comprador), ruta
//   tipo=sincronizacion: control de lectura de los SFTP (ejecuciones, archivos por día y archivos con error)
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta

  const p = req.nextUrl.searchParams
  const hoy = hoyBogota()
  const desde = FECHA.test(p.get('desde') ?? '') ? p.get('desde')! : hoy
  const hasta = FECHA.test(p.get('hasta') ?? '') ? p.get('hasta')! : hoy
  if (desde > hasta) return NextResponse.json({ error: 'La fecha inicial es posterior a la final' }, { status: 400 })

  if (p.get('tipo') === 'sincronizacion') return NextResponse.json({ hoy, ...await datosSincronizacion(desde, hasta) })

  const campo = p.get('campo') === 'orden' ? 'orden' : 'entrega'
  const datos = await datosReportes({ desde, hasta, campo, cadena: p.get('cadena') ?? '', ruta: p.get('ruta') ?? '' })
  return NextResponse.json({ hoy, desde, hasta, campo, ...datos })
}
