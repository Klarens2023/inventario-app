import { randomInt } from 'node:crypto'

// Sin caracteres que se confunden al dictarla o leerla (0/O, 1/l/I).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export const LARGO_PASSWORD_TEMPORAL = 10

/**
 * Contraseña temporal para usuarios nuevos o restablecidos (AUD-03).
 *
 * Reemplaza la genérica "123456": con ella, cualquiera que conociera el nombre
 * de usuario podía entrar antes que el titular y fijar su propia contraseña.
 * Se genera con `crypto.randomInt` (sin sesgo de módulo), solo se guarda su
 * hash y se devuelve en claro una única vez a quien creó/restableció la cuenta.
 * El usuario queda con `debe_cambiar_password = true`.
 *
 * @returns 10 caracteres alfanuméricos (~57 bits de entropía)
 */
export function generarPasswordTemporal(): string {
  let s = ''
  for (let i = 0; i < LARGO_PASSWORD_TEMPORAL; i++) s += ALFABETO[randomInt(ALFABETO.length)]
  return s
}
