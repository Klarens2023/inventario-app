import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/cen/acceso'
import { consultarTodo, condicion, siesaConfigurado } from '@/lib/siesa/connekta'

// GET /api/logistica/ordenes-cen/bodegas — bodegas de Siesa de la instalación 001, para asignarlas a mano a las sucursales
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  if (!siesaConfigurado()) return NextResponse.json({ error: 'La API de Siesa no está configurada' }, { status: 503 })
  try {
    const filas = await consultarTodo<Record<string, unknown>>('API_v2_Bodegas', condicion('f150_id_instalacion', '001'))
    const bodegas = filas
      .map(b => ({ id: String(b.f150_id).trim(), descripcion: String(b.f150_descripcion ?? '').trim(), activa: Number(b.f150_ind_estado) === 1 }))
      .sort((a, b) => a.id.localeCompare(b.id))
    return NextResponse.json(bodegas)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudieron consultar las bodegas' }, { status: 502 })
  }
}
