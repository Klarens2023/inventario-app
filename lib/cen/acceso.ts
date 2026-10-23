import { NextRequest, NextResponse } from 'next/server'
import type { AuthUser } from '@/lib/api-auth'
import { exigirAcceso } from '@/lib/acceso'

/**
 * Acceso a las rutas de órdenes EDI: módulo ordenes_cen, con sesión web o token
 * móvil. Se conserva esta firma ({ user } | { respuesta }) porque la usan 13 rutas;
 * por dentro delega en el control único de lib/acceso.ts.
 */
export async function verificarAcceso(req: NextRequest): Promise<{ user: AuthUser } | { respuesta: NextResponse }> {
  const acceso = await exigirAcceso(req, { modulos: ['ordenes_cen'], movil: true })
  return acceso.ok ? { user: acceso.user } : { respuesta: acceso.respuesta }
}
