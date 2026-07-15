// Formateadores de campo para el plano de ancho fijo de Siesa ERP.
// Cada función produce una cadena de exactamente `tam` caracteres, tal como
// lo exige la especificación en "Copia de Imp-UnoEE-Docto contable.xls".

export function num(valor: string | number | null | undefined, tam: number): string {
  const soloDigitos = String(valor ?? '').replace(/\D/g, '')
  const sinCerosIzq = soloDigitos.replace(/^0+(?=\d)/, '') || '0'
  if (sinCerosIzq.length > tam) {
    throw new Error(`Valor numérico "${valor}" excede ${tam} dígitos`)
  }
  return sinCerosIzq.padStart(tam, '0')
}

export function alpha(valor: string | number | null | undefined, tam: number): string {
  const s = String(valor ?? '')
  if (s.length > tam) {
    throw new Error(`Texto "${s}" excede ${tam} caracteres`)
  }
  return s.padEnd(tam, ' ')
}

export function fecha(valor: string | null | undefined, tam = 8): string {
  if (!valor) return ' '.repeat(tam)
  const s = String(valor).replace(/[^0-9]/g, '')
  if (!/^\d{8}$/.test(s)) {
    throw new Error(`Fecha "${valor}" debe tener formato AAAAMMDD`)
  }
  return s
}

// Formato Siesa para valores monetarios: signo + 15 enteros + punto + 4 decimales (21 caracteres).
export function valorMonetario(valor: number | string | null | undefined): string {
  const n = Number(valor) || 0
  const signo = n < 0 ? '-' : '+'
  const [enteros, decimales] = Math.abs(n).toFixed(4).split('.')
  if (enteros.length > 15) {
    throw new Error(`Valor ${valor} excede el máximo de 15 dígitos enteros`)
  }
  return `${signo}${enteros.padStart(15, '0')}.${decimales}`
}

export const CERO_VALOR = valorMonetario(0)

// El plano de Siesa es de ancho fijo en un byte por carácter (Latin-1/Windows-1252).
// Si se codificara como UTF-8, las tildes y la "ñ" ocuparían 2 bytes y correrían
// todas las columnas siguientes. Esta función codifica el texto final byte a byte.
export function codificarLatin1(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const code = texto.charCodeAt(i)
    if (code > 255) {
      throw new Error(`El carácter "${texto[i]}" (posición ${i}) no es válido en el plano; use solo letras, números y tildes estándar.`)
    }
    bytes[i] = code
  }
  return bytes
}
