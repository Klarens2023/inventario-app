import { sql } from './db'

/**
 * Estado vigente de un usuario según la base de datos.
 *
 * Las sesiones son JWT sin estado (cookie de NextAuth de 8–24 h y token móvil
 * de 30 días): si solo se confiara en lo que trae el token, un usuario
 * desactivado o al que se le quitó un rol/módulo seguiría entrando hasta que
 * el token venciera. Por eso cada petición autenticada vuelve a leer aquí el
 * estado real (ver `callbacks.jwt` en lib/auth.ts y `getAuthUser` en
 * lib/api-auth.ts).
 */
export type EstadoUsuario = {
  rol: string
  area: string
  punto_venta_id: number | null
  debe_cambiar_password: boolean
  modulos: string[]
}

/**
 * Lee el estado actual del usuario en una sola consulta (por PK).
 *
 * @param id id numérico del usuario (como viene en el token, en texto o número)
 * @returns el estado vigente, o `null` si el usuario no existe o está inactivo
 *          (en ese caso la sesión debe tratarse como revocada).
 * @throws si la consulta a la base de datos falla: quien llama decide; nunca se
 *         asume "activo" ante un error.
 */
export async function cargarEstadoUsuario(id: string | number): Promise<EstadoUsuario | null> {
  const idNum = typeof id === 'number' ? id : parseInt(id, 10)
  if (!Number.isInteger(idNum) || idNum <= 0) return null

  const [u] = await sql`
    SELECT u.rol, u.area, u.punto_venta_id, u.debe_cambiar_password,
           COALESCE((SELECT array_agg(m.modulo) FROM usuario_modulos m WHERE m.usuario_id = u.id), '{}') AS modulos
    FROM usuarios u
    WHERE u.id = ${idNum} AND u.activo = true
  `
  if (!u) return null

  const rol = (u.rol as string | null) ?? 'usuario'
  return {
    rol,
    // Misma regla que en el login: el admin siempre opera en el área 'general'.
    area: rol === 'admin' ? 'general' : ((u.area as string | null) ?? 'logistica'),
    punto_venta_id: (u.punto_venta_id as number | null) ?? null,
    debe_cambiar_password: Boolean(u.debe_cambiar_password),
    modulos: (u.modulos as string[] | null) ?? [],
  }
}
