import { sql } from './db'

const MAX_INTENTOS = 5
const BLOQUEO_MINUTOS = 15

export type EstadoUsuarioLogin = {
  id: number
  password_hash: string
  bloqueado_hasta: string | Date | null
}

export function minutosRestantesBloqueo(usuario: Pick<EstadoUsuarioLogin, 'bloqueado_hasta'>): number {
  if (!usuario.bloqueado_hasta) return 0
  const restante = new Date(usuario.bloqueado_hasta).getTime() - Date.now()
  return restante > 0 ? Math.ceil(restante / 60000) : 0
}

export async function registrarIntentoFallido(usuarioId: number): Promise<void> {
  await sql`
    UPDATE usuarios
    SET intentos_fallidos = intentos_fallidos + 1,
        bloqueado_hasta = CASE
          WHEN intentos_fallidos + 1 >= ${MAX_INTENTOS}
          THEN NOW() + make_interval(mins => ${BLOQUEO_MINUTOS})
          ELSE bloqueado_hasta
        END
    WHERE id = ${usuarioId}
  `
}

export async function resetearIntentosFallidos(usuarioId: number): Promise<void> {
  await sql`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ${usuarioId}`
}
