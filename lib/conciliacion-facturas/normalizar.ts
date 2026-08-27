// Normalización de NIT y de número de factura para el módulo de conciliación
// de facturas de proveedores (Invoicing vs. causación en Siesa ERP).
//
// Reglas (ver brief del usuario): la normalización de la factura debe
// resolver diferencias de FORMATO (mayúsculas, espacios, guiones, puntos,
// barras, ceros a la izquierda en la parte numérica) sin asumir que dos
// facturas distintas son la misma solo por parecerse. El valor original
// siempre se conserva aparte para mostrarlo al usuario.

export function normalizarNit(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim().replace(/[^\d]/g, '')
}

export type FacturaNormalizada = {
  original: string
  normalizada: string
  sinSeparadores: string // mayúsculas, sin guiones/espacios/puntos — SIN dividir en prefijo/número
  prefijo: string
  numero: string   // parte numérica sin ceros a la izquierda
  // true cuando el prefijo se determinó a partir de un separador explícito en
  // el dato original (ej. "EK03-01076078") — ese límite es confiable. Cuando
  // el dato no trae separador (ej. "EK031076078"), el límite prefijo/número
  // es una suposición ambigua (podría ser "EK"+"031076078", "EK03"+"1076078",
  // etc.) y NO debe tratarse con la misma confianza.
  prefijoConfiable: boolean
}

const CARACTERES_SEPARADORES = /[\s\-_.\/]/g

export function normalizarFactura(valor: string | number | null | undefined): FacturaNormalizada {
  const original = valor === null || valor === undefined ? '' : String(valor).trim()
  if (!original) {
    return { original: '', normalizada: '', sinSeparadores: '', prefijo: '', numero: '', prefijoConfiable: false }
  }

  const upper = original.toUpperCase().replace(/^-/, '')
  const sinSeparadores = upper.replace(CARACTERES_SEPARADORES, '')

  // El "prefijo" real de muchos proveedores mezcla letras y dígitos
  // (ej. "FE3C", "M4M3", "I2F1"). Cuando el dato SÍ trae un separador
  // (guion/espacio/punto/barra), ese separador marca la frontera real entre
  // prefijo y número — hay que usarla ANTES de borrar el separador, porque
  // si el prefijo termina en dígito (ej. "M4M3-00007282") y se borra el
  // guion primero, ese dígito final del prefijo se fusiona con los ceros
  // del número y el recorte de ceros lo absorbe por error.
  const conSeparador = upper.match(/^(.*?)[\s\-_./]+(\d+)$/)
  let prefijo: string
  let numeroCrudo: string
  let prefijoConfiable: boolean
  if (conSeparador) {
    prefijo = conSeparador[1].replace(CARACTERES_SEPARADORES, '')
    numeroCrudo = conSeparador[2]
    prefijoConfiable = true
  } else {
    // Sin separador — no hay forma confiable de saber dónde termina el
    // prefijo si este también tiene dígitos (ej. "EK031076078" podría ser
    // "EK"+"031076078" o "EK03"+"1076078"); se usa la cola numérica más
    // larga posible solo como mejor esfuerzo, marcada como NO confiable.
    const m = sinSeparadores.match(/^(.*?)(\d+)$/)
    if (!m) {
      // No hay ninguna parte numérica (ej. viene sin dígitos) — se usa tal
      // cual, sin inventar estructura de prefijo/número.
      return { original, normalizada: sinSeparadores, sinSeparadores, prefijo: '', numero: '', prefijoConfiable: false }
    }
    prefijo = m[1]
    numeroCrudo = m[2]
    prefijoConfiable = false
  }

  const numero = numeroCrudo.replace(/^0+(?=\d)/, '')
  return { original, normalizada: `${prefijo}${numero}`, sinSeparadores, prefijo, numero, prefijoConfiable }
}

// Compara dos facturas ya normalizadas y dice si son equivalentes tras
// resolver diferencias de formato — incluyendo el caso de un cero de más
// insertado justo en la frontera prefijo/número cuando uno de los dos lados
// no tenía separador para revelar dónde termina el prefijo (ej. Invoicing
// "EK031076078" vs ERP "EK03-01076078": mismo documento, un cero de más).
export function sonFacturasEquivalentes(a: FacturaNormalizada, b: FacturaNormalizada): boolean {
  if (a.normalizada === b.normalizada) return true

  function anclarPrefijo(confiable: FacturaNormalizada, otro: FacturaNormalizada): boolean {
    if (!confiable.prefijoConfiable || !confiable.prefijo) return false
    if (!otro.sinSeparadores.startsWith(confiable.prefijo)) return false
    const colaCruda = otro.sinSeparadores.slice(confiable.prefijo.length)
    const cola = colaCruda.replace(/^0+(?=\d)/, '') || '0'
    return cola === confiable.numero
  }

  return anclarPrefijo(a, b) || anclarPrefijo(b, a)
}

// Distancia de edición (Levenshtein) simple, para detectar diferencias de
// un caracter (posible error de digitación / transposición) en la Nivel 3.
export function distanciaEdicion(a: string, b: string): number {
  if (a === b) return 0
  const filas = a.length + 1
  const cols = b.length + 1
  const dp: number[][] = Array.from({ length: filas }, () => new Array(cols).fill(0))
  for (let i = 0; i < filas; i++) dp[i][0] = i
  for (let j = 0; j < cols; j++) dp[0][j] = j
  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < cols; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // eliminar
        dp[i][j - 1] + 1,      // insertar
        dp[i - 1][j - 1] + costo, // sustituir
      )
    }
  }
  return dp[filas - 1][cols - 1]
}
