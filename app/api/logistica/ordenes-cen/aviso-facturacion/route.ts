import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { avisarFacturacion } from '@/lib/cen/avisoFacturacion'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/logistica/ordenes-cen/aviso-facturacion — correo a facturación con los pedidos creados en Siesa.
// Body: { ids: number[] } (los pedidos que se acaban de crear en bloque) o { ruta: "ARA" } (todo lo
// pendiente de avisar de esa ruta). En ambos casos van también los institucionales sin avisar de las
// mismas relaciones. Responde 200 con { ok, mensaje, pedidos } aunque el correo falle, para mostrarlo.
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const b = await req.json().catch(() => ({})) as { ids?: unknown; ruta?: unknown; solo_seleccion?: unknown; totales?: unknown }
  const ids = Array.isArray(b.ids) ? Array.from(new Set(b.ids.map(Number).filter(Number.isInteger))).slice(0, 500) : null
  const ruta = typeof b.ruta === 'string' ? b.ruta.trim().toUpperCase().slice(0, 40) : ''
  if (!ids?.length && !ruta) return NextResponse.json({ error: 'Indica los pedidos o la ruta' }, { status: 400 })
  // solo_seleccion: solo los pedidos indicados (sin agregar los PVK de las relaciones); totales: por ítem y por cliente
  const opciones = { soloSeleccion: b.solo_seleccion === true, totales: b.totales === true }
  return NextResponse.json(await avisarFacturacion(ids?.length ? { ids, ...opciones } : { ruta, ...opciones }, { id: acceso.user.id, name: acceso.user.name }))
}
