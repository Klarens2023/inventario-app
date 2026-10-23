// IPs de confianza para el límite de login por IP (lib/loginBruteForce.ts).
//
// Toda la oficina sale a internet por el mismo segmento público, así que para
// el límite por IP todos los empleados cuentan como una sola conexión. Si
// alguien dentro de la red acumulara fallos, se bloquearía la oficina entera.
// Las IPs de esta lista no cuentan fallos ni se bloquean por IP; el bloqueo por
// USUARIO (5 fallos seguidos) sigue aplicando a todos.
//
// Se configura en la variable LOGIN_IPS_CONFIANZA (Vercel y .env.local), con
// IPs sueltas o rangos CIDR separados por coma, por ejemplo:
//   LOGIN_IPS_CONFIANZA=190.242.100.248/29
// Solo IPv4. Sin la variable, ninguna IP es de confianza.

/** Convierte "a.b.c.d" a un número de 32 bits, o null si no es IPv4 válida. */
function ipANumero(ip: string): number | null {
  const partes = ip.trim().split('.')
  if (partes.length !== 4) return null
  let n = 0
  for (const p of partes) {
    // Cada octeto: solo dígitos, entre 0 y 255
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null
    n = n * 256 + Number(p)
  }
  return n
}

/** ¿La IP está dentro del rango? Acepta "a.b.c.d" (exacta) o "a.b.c.d/n". */
export function ipEnRango(ip: string, rango: string): boolean {
  const [base, bitsTexto] = rango.trim().split('/')
  const ipNum = ipANumero(ip)
  const baseNum = ipANumero(base)
  if (ipNum === null || baseNum === null) return false
  const bits = bitsTexto === undefined ? 32 : Number(bitsTexto)
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
  // Tamaño del bloque: /29 → 8 direcciones. Se compara a qué bloque pertenece
  // cada una (división entera), sin operadores de bits para evitar el signo de 32 bits.
  const tamano = 2 ** (32 - bits)
  return Math.floor(ipNum / tamano) === Math.floor(baseNum / tamano)
}

/** ¿La IP está en alguno de los rangos de la lista (texto separado por comas)? */
export function esIpDeConfianza(ip: string, lista = process.env.LOGIN_IPS_CONFIANZA ?? ''): boolean {
  return lista.split(',').filter(r => r.trim()).some(r => ipEnRango(ip, r))
}
