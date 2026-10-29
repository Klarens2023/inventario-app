// Verificación en dos pasos (2FA) de los administradores: lectura y escritura en
// la base. El cálculo de los códigos y el cifrado están en lib/totp.ts.
//
// Reglas (decididas el 29/10/2026):
//   - Obligatoria para el rol admin; los demás roles no la usan.
//   - Un admin que aún no la configuró solo puede entrar a /seguridad para
//     activarla (la sesión queda restringida, igual que con el cambio de
//     contraseña pendiente).
//   - Se pide en el login web y en el de la app móvil.
//   - Sin la variable TOTP_CLAVE la función queda apagada (no bloquea a nadie).
import { sql } from './db'
import {
  claveMaestra, cifrarClave, descifrarClave, generarClave, base32Codificar, urlOtpauth,
  verificarCodigo, generarCodigosRecuperacion, huellaRecuperacion, pareceCodigoRecuperacion,
} from './totp'

/** ¿Está configurada la clave maestra? Sin ella no se exige ni se puede activar. */
export function dosPasosHabilitado(): boolean {
  return claveMaestra() !== null
}

/** ¿A este rol se le exige? (solo admin, y solo si la función está habilitada) */
export function rolRequiereDosPasos(rol: string | null | undefined): boolean {
  return rol === 'admin' && dosPasosHabilitado()
}

function maestra(): Buffer {
  const m = claveMaestra()
  if (!m) throw new Error('TOTP_CLAVE no está configurada')
  return m
}

/** Estado para la pantalla /seguridad. */
export async function estadoDosPasos(usuarioId: number) {
  const [u] = await sql`
    SELECT rol, totp_activo, totp_activado_en,
           (SELECT count(*)::int FROM usuario_codigos_recuperacion c WHERE c.usuario_id = u.id AND c.usado_en IS NULL) AS restantes
    FROM usuarios u WHERE u.id = ${usuarioId}`
  return {
    // Rol leído de la BD: la sesión restringida (2FA pendiente) lo publica vacío
    rol: (u?.rol as string | null) ?? null,
    activo: Boolean(u?.totp_activo),
    activadoEn: (u?.totp_activado_en as string | null) ?? null,
    codigosRestantes: (u?.restantes as number) ?? 0,
  }
}

/**
 * Paso 1 de la activación: genera una clave nueva y la deja PENDIENTE (aún no
 * se exige) hasta que la persona confirme un código de su app.
 * @returns la dirección otpauth (para el QR) y la clave en texto (para escribirla a mano)
 */
export async function iniciarActivacion(usuarioId: number, username: string) {
  const clave = generarClave()
  await sql`UPDATE usuarios SET totp_pendiente = ${cifrarClave(clave, maestra())} WHERE id = ${usuarioId}`
  return { otpauth: urlOtpauth(clave, username), clave: base32Codificar(clave) }
}

/**
 * Paso 2: si el código coincide con la clave pendiente, la activa y genera
 * 10 códigos de recuperación nuevos (se devuelven UNA sola vez).
 * @returns los códigos de recuperación, o null si el código no coincide
 */
export async function confirmarActivacion(usuarioId: number, codigo: string): Promise<string[] | null> {
  const [u] = await sql`SELECT totp_pendiente FROM usuarios WHERE id = ${usuarioId}`
  if (!u?.totp_pendiente) return null
  const clave = descifrarClave(u.totp_pendiente as string, maestra())
  const paso = verificarCodigo(clave, codigo)
  if (paso === null) return null

  const codigos = generarCodigosRecuperacion()
  const huellas = codigos.map(c => huellaRecuperacion(c, maestra()))
  // Todo junto: la clave pasa de pendiente a activa y se reemplazan los códigos de recuperación
  await sql.transaction([
    sql`UPDATE usuarios SET totp_clave = totp_pendiente, totp_pendiente = NULL, totp_activo = TRUE,
               totp_activado_en = NOW(), totp_ultimo_paso = ${paso}
        WHERE id = ${usuarioId}`,
    sql`DELETE FROM usuario_codigos_recuperacion WHERE usuario_id = ${usuarioId}`,
    sql`INSERT INTO usuario_codigos_recuperacion (usuario_id, huella)
        SELECT ${usuarioId}, unnest(${huellas}::text[])`,
  ])
  return codigos
}

/**
 * Comprueba el segundo factor en el login: código de 6 dígitos de la app, o un
 * código de recuperación (que queda gastado).
 * @returns 'totp' | 'recuperacion' si es válido, o null
 */
export async function verificarSegundoFactor(usuarioId: number, codigo: string): Promise<'totp' | 'recuperacion' | null> {
  const texto = (codigo ?? '').trim()

  if (pareceCodigoRecuperacion(texto)) {
    // Se marca como usado en la misma sentencia que lo busca: no sirve dos veces
    const [usado] = await sql`
      UPDATE usuario_codigos_recuperacion SET usado_en = NOW()
      WHERE id = (SELECT id FROM usuario_codigos_recuperacion
                  WHERE usuario_id = ${usuarioId} AND huella = ${huellaRecuperacion(texto, maestra())} AND usado_en IS NULL
                  LIMIT 1)
      RETURNING id`
    return usado ? 'recuperacion' : null
  }

  const [u] = await sql`SELECT totp_clave, totp_ultimo_paso FROM usuarios WHERE id = ${usuarioId} AND totp_activo`
  if (!u?.totp_clave) return null
  const ultimo = u.totp_ultimo_paso === null ? null : Number(u.totp_ultimo_paso)
  const paso = verificarCodigo(descifrarClave(u.totp_clave as string, maestra()), texto, ultimo)
  if (paso === null) return null
  // Guarda el paso solo si sigue siendo mayor (dos peticiones con el mismo código: solo una pasa)
  const [ok] = await sql`
    UPDATE usuarios SET totp_ultimo_paso = ${paso}
    WHERE id = ${usuarioId} AND (totp_ultimo_paso IS NULL OR totp_ultimo_paso < ${paso})
    RETURNING id`
  return ok ? 'totp' : null
}

/** Genera 10 códigos de recuperación nuevos (invalida los anteriores). Requiere 2FA activa. */
export async function regenerarCodigos(usuarioId: number): Promise<string[]> {
  const codigos = generarCodigosRecuperacion()
  const huellas = codigos.map(c => huellaRecuperacion(c, maestra()))
  await sql.transaction([
    sql`DELETE FROM usuario_codigos_recuperacion WHERE usuario_id = ${usuarioId}`,
    sql`INSERT INTO usuario_codigos_recuperacion (usuario_id, huella) SELECT ${usuarioId}, unnest(${huellas}::text[])`,
  ])
  return codigos
}

/** Quita la verificación (celular perdido): al siguiente ingreso deberá activarla de nuevo. */
export async function reiniciarDosPasos(usuarioId: number) {
  await sql.transaction([
    sql`UPDATE usuarios SET totp_clave = NULL, totp_pendiente = NULL, totp_activo = FALSE,
               totp_activado_en = NULL, totp_ultimo_paso = NULL
        WHERE id = ${usuarioId}`,
    sql`DELETE FROM usuario_codigos_recuperacion WHERE usuario_id = ${usuarioId}`,
  ])
}

/**
 * Qué hacer con el segundo factor en un inicio de sesión cuya contraseña ya se
 * comprobó. La usan el login web (lib/auth.ts) y el móvil.
 *
 *   'no-aplica'       no es admin (o la función está apagada): entra normal
 *   'sin-configurar'  admin sin 2FA: entra con sesión restringida a /seguridad
 *   'falta-codigo'    admin con 2FA y no mandó código: pedirlo
 *   'invalido'        el código no sirve: cuenta como intento fallido
 *   'totp' | 'recuperacion'  código correcto (el de recuperación queda gastado)
 */
export async function segundoFactorLogin(
  usuario: { id: number; rol: string | null; totp_activo?: boolean | null },
  codigo: string | null | undefined,
): Promise<'no-aplica' | 'sin-configurar' | 'falta-codigo' | 'invalido' | 'totp' | 'recuperacion'> {
  if (!rolRequiereDosPasos(usuario.rol)) return 'no-aplica'
  if (!usuario.totp_activo) return 'sin-configurar'
  if (!codigo?.trim()) return 'falta-codigo'
  return (await verificarSegundoFactor(usuario.id, codigo)) ?? 'invalido'
}
