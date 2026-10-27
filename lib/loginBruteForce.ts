import bcrypt from 'bcryptjs'
import { sql } from './db'
import { esIpDeConfianza } from './ipConfianza'

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

/**
 * Suma un fallo a la cuenta y la bloquea al llegar a MAX_INTENTOS seguidos.
 * @returns true si ESTE fallo dejó la cuenta bloqueada (para registrarlo en la bitácora)
 */
export async function registrarIntentoFallido(usuarioId: number): Promise<boolean> {
  const [fila] = await sql`
    UPDATE usuarios
    SET intentos_fallidos = intentos_fallidos + 1,
        bloqueado_hasta = CASE
          WHEN intentos_fallidos + 1 >= ${MAX_INTENTOS}
          THEN NOW() + make_interval(mins => ${BLOQUEO_MINUTOS})
          ELSE bloqueado_hasta
        END
    WHERE id = ${usuarioId}
    RETURNING (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
  `
  return Boolean(fila?.bloqueado)
}

export async function resetearIntentosFallidos(usuarioId: number): Promise<void> {
  await sql`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ${usuarioId}`
}

// ─── Límite por IP ──────────────────────────────────────────────────────────
// Complementa el bloqueo por usuario: frena a quien prueba una contraseña común
// contra muchas cuentas desde la misma conexión. Los umbrales son holgados
// porque una oficina entera puede salir a internet por una sola IP.
const MAX_FALLOS_IP = 30        // fallos permitidos por IP dentro de la ventana
const VENTANA_IP_MINUTOS = 15   // duración de la ventana de conteo
const BLOQUEO_IP_MINUTOS = 15   // cuánto dura el bloqueo al superar el límite

/**
 * IP del cliente. En Vercel, x-real-ip y x-forwarded-for los fija la propia
 * plataforma (sobrescribe lo que mande el cliente), así que no se pueden falsear.
 * Acepta tanto Headers (rutas API) como el objeto plano que entrega NextAuth.
 */
export function ipCliente(headers: Headers | Record<string, unknown> | undefined): string {
  if (!headers) return 'desconocida'
  const leer = (n: string) =>
    headers instanceof Headers ? headers.get(n) : (headers[n] as string | undefined) ?? null
  // x-forwarded-for puede traer una cadena "cliente, proxy1, proxy2": el primero es el cliente
  return leer('x-real-ip') ?? leer('x-forwarded-for')?.split(',')[0].trim() ?? 'desconocida'
}

/**
 * Minutos que le faltan a la IP para poder volver a intentar (0 = puede).
 * Si la tabla aún no existe (migración sin correr) o la BD falla, deja pasar:
 * el límite por IP es una capa extra y no debe tumbar el login de nadie.
 */
export async function minutosBloqueoIp(ip: string): Promise<number> {
  // IPs de la empresa (LOGIN_IPS_CONFIANZA): nunca se bloquean por IP
  if (esIpDeConfianza(ip)) return 0
  try {
    const [fila] = await sql`
      SELECT CEIL(EXTRACT(EPOCH FROM (bloqueado_hasta - NOW())) / 60)::int AS minutos
      FROM login_intentos_ip
      WHERE ip = ${ip} AND bloqueado_hasta > NOW()
    `
    return fila?.minutos ?? 0
  } catch (e) {
    console.warn('[login] Límite por IP desactivado (¿falta scripts/migrate-add-login-ip.js?):', (e as Error).message)
    return 0
  }
}

/**
 * Suma un fallo a la IP en una sola sentencia atómica (sin carreras entre
 * peticiones simultáneas). Si la ventana venció, el conteo arranca de nuevo.
 * Al llegar al máximo, bloquea la IP durante BLOQUEO_IP_MINUTOS.
 * Un login exitoso NO reinicia el conteo: si lo hiciera, un atacante con una
 * cuenta válida podría "limpiar" su IP entre intento e intento.
 */
export async function registrarFalloIp(ip: string): Promise<void> {
  // IPs de la empresa: no se cuentan (el bloqueo por usuario sigue aplicando)
  if (esIpDeConfianza(ip)) return
  try {
    await sql`
      INSERT INTO login_intentos_ip AS t (ip, intentos, ventana_desde)
      VALUES (${ip}, 1, NOW())
      ON CONFLICT (ip) DO UPDATE SET
        -- ventana vencida → se cuenta desde 1; si no, se suma
        intentos = CASE WHEN t.ventana_desde < NOW() - make_interval(mins => ${VENTANA_IP_MINUTOS})
                        THEN 1 ELSE t.intentos + 1 END,
        ventana_desde = CASE WHEN t.ventana_desde < NOW() - make_interval(mins => ${VENTANA_IP_MINUTOS})
                             THEN NOW() ELSE t.ventana_desde END,
        -- con el fallo número MAX_FALLOS_IP dentro de la ventana, se bloquea
        bloqueado_hasta = CASE WHEN t.ventana_desde >= NOW() - make_interval(mins => ${VENTANA_IP_MINUTOS})
                                    AND t.intentos + 1 >= ${MAX_FALLOS_IP}
                               THEN NOW() + make_interval(mins => ${BLOQUEO_IP_MINUTOS})
                               ELSE t.bloqueado_hasta END
    `
    // Limpieza ocasional (≈2 % de los fallos) de IPs viejas para que la tabla no crezca
    if (Math.random() < 0.02) {
      await sql`
        DELETE FROM login_intentos_ip
        WHERE ventana_desde < NOW() - INTERVAL '1 day'
          AND (bloqueado_hasta IS NULL OR bloqueado_hasta < NOW())
      `
    }
  } catch (e) {
    console.warn('[login] No se pudo registrar el fallo por IP:', (e as Error).message)
  }
}

/** Mensaje común para web y móvil cuando la IP está bloqueada. */
export const mensajeBloqueoIp = (minutos: number) =>
  `Demasiados intentos fallidos desde esta conexión. Intenta de nuevo en ${minutos} minuto(s).`

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
