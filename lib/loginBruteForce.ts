import bcrypt from 'bcryptjs'
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

// Hash de una cadena aleatoria, calculado una vez por instancia: nunca coincide
// con ninguna contraseña.
const HASH_SENUELO = bcrypt.hashSync(Math.random().toString(36) + Date.now(), 10)

/**
 * Compara contra un hash señuelo cuando el usuario no existe o está inactivo
 * (AUD-17). Sin esto el login respondía al instante para usuarios inexistentes
 * y tardaba ~70 ms (bcrypt) para los existentes, lo que permitía averiguar qué
 * nombres de usuario existen midiendo el tiempo de respuesta.
 */
export async function compararSenuelo(password: string): Promise<void> {
  await bcrypt.compare(password, HASH_SENUELO)
}
