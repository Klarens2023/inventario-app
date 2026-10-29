// Verificación en dos pasos (2FA) con códigos TOTP (RFC 6238): los mismos de
// Google Authenticator, Microsoft Authenticator, etc. Sin dependencias: solo
// node:crypto. Lo usan lib/dosPasos.ts (base de datos) y las rutas de login.
//
// - La clave de cada persona (20 bytes aleatorios) se guarda CIFRADA en la base
//   con AES-256-GCM y la clave maestra TOTP_CLAVE (variable de entorno). Una
//   copia de la base sin esa variable no sirve para generar códigos.
// - Los códigos de recuperación se guardan como HMAC-SHA256 con TOTP_CLAVE:
//   no se pueden leer de vuelta, solo comprobar.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const PASO_SEGUNDOS = 30 // un código nuevo cada 30 s
const DIGITOS = 6
const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// ─── Base32 (formato en que las apps autenticadoras reciben la clave) ──────

export function base32Codificar(datos: Buffer): string {
  let bits = 0, valor = 0, salida = ''
  for (let i = 0; i < datos.length; i++) {
    valor = (valor << 8) | datos[i]
    bits += 8
    while (bits >= 5) {
      salida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) salida += ALFABETO_BASE32[(valor << (5 - bits)) & 31]
  return salida
}

export function base32Decodificar(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0, valor = 0
  const bytes: number[] = []
  for (const c of limpio) {
    const i = ALFABETO_BASE32.indexOf(c)
    if (i < 0) throw new Error('Clave base32 inválida')
    valor = (valor << 5) | i
    bits += 5
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// ─── Códigos TOTP ────────────────────────────────────────────────────────────

/** Clave nueva para una persona: 20 bytes aleatorios (160 bits, lo que pide el RFC para SHA-1). */
export function generarClave(): Buffer {
  return randomBytes(20)
}

/** Número de "paso" de 30 s para un instante (en milisegundos). */
export function pasoActual(ahoraMs = Date.now()): number {
  return Math.floor(ahoraMs / 1000 / PASO_SEGUNDOS)
}

/** Código de `digitos` cifras para un paso dado (HOTP, RFC 4226, con HMAC-SHA1). */
export function codigoParaPaso(clave: Buffer, paso: number, digitos = DIGITOS): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(paso))
  const hmac = createHmac('sha1', clave).update(contador).digest()
  // "Truncamiento dinámico": 4 bytes a partir del desplazamiento que indica el último nibble
  const desplazamiento = hmac[hmac.length - 1] & 0x0f
  const numero = (hmac.readUInt32BE(desplazamiento) & 0x7fffffff) % 10 ** digitos
  return String(numero).padStart(digitos, '0')
}

/**
 * Comprueba un código de 6 dígitos. Acepta el paso actual y uno antes o después
 * (±30 s) por diferencias de reloj del celular.
 *
 * @param ultimoPasoUsado paso del último código aceptado: no se acepta el mismo
 *        código dos veces (si alguien lo ve por encima del hombro, ya no sirve).
 * @returns el paso que coincidió (hay que guardarlo como último usado), o null.
 */
export function verificarCodigo(clave: Buffer, codigo: string, ultimoPasoUsado: number | null = null, ahoraMs = Date.now()): number | null {
  const limpio = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpio)) return null
  const actual = pasoActual(ahoraMs)
  for (const paso of [actual - 1, actual, actual + 1]) {
    if (ultimoPasoUsado !== null && paso <= ultimoPasoUsado) continue
    const esperado = Buffer.from(codigoParaPaso(clave, paso))
    // Comparación en tiempo constante
    if (timingSafeEqual(esperado, Buffer.from(limpio))) return paso
  }
  return null
}

/** Dirección otpauth:// que se convierte en el código QR para la app autenticadora. */
export function urlOtpauth(clave: Buffer, usuario: string, emisor = "Operaciones Klaren's"): string {
  const etiqueta = encodeURIComponent(`${emisor}:${usuario}`)
  const params = new URLSearchParams({ secret: base32Codificar(clave), issuer: emisor, algorithm: 'SHA1', digits: String(DIGITOS), period: String(PASO_SEGUNDOS) })
  return `otpauth://totp/${etiqueta}?${params}`
}

// ─── Cifrado de la clave en la base (AES-256-GCM con TOTP_CLAVE) ────────────

/**
 * Clave maestra desde TOTP_CLAVE (32 bytes en base64). Sin ella la verificación
 * en dos pasos queda desactivada (ver dosPasosHabilitado en lib/dosPasos.ts).
 */
export function claveMaestra(valor = process.env.TOTP_CLAVE): Buffer | null {
  if (!valor) return null
  const b = Buffer.from(valor, 'base64')
  return b.length === 32 ? b : null
}

/** Cifra la clave de una persona → "v1.<iv>.<etiqueta>.<cifrado>" (base64url). */
export function cifrarClave(clave: Buffer, maestra: Buffer): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', maestra, iv)
  const cifrado = Buffer.concat([c.update(clave), c.final()])
  return ['v1', iv, c.getAuthTag(), cifrado].map(p => typeof p === 'string' ? p : p.toString('base64url')).join('.')
}

/** Descifra lo que produjo cifrarClave; lanza error si fue alterado o la maestra no coincide. */
export function descifrarClave(guardado: string, maestra: Buffer): Buffer {
  const [version, iv, etiqueta, cifrado] = guardado.split('.')
  if (version !== 'v1') throw new Error('Formato de clave 2FA desconocido')
  const d = createDecipheriv('aes-256-gcm', maestra, Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(etiqueta, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(cifrado, 'base64url')), d.final()])
}

// ─── Códigos de recuperación ─────────────────────────────────────────────────

// Sin letras ni números que se confundan al copiarlos a mano (0/O, 1/I/L)
const ALFABETO_RECUPERACION = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Diez códigos "XXXX-XXXX" de un solo uso (~39 bits cada uno). */
export function generarCodigosRecuperacion(cantidad = 10): string[] {
  return Array.from({ length: cantidad }, () => {
    const b = randomBytes(8)
    const s = Array.from(b, x => ALFABETO_RECUPERACION[x % ALFABETO_RECUPERACION.length]).join('')
    return `${s.slice(0, 4)}-${s.slice(4)}`
  })
}

/** Huella de un código de recuperación para guardarla (no se guarda el código). */
export function huellaRecuperacion(codigo: string, maestra: Buffer): string {
  const normal = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return createHmac('sha256', maestra).update(normal).digest('hex')
}

/** ¿Tiene forma de código de recuperación (8 caracteres, con o sin guion)? */
export function pareceCodigoRecuperacion(codigo: string): boolean {
  return /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(codigo.trim())
}
