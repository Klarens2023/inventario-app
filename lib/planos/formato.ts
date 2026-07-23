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

// Formato Siesa para valores sin signo (activos fijos, adopción NIIF):
// 15 enteros + punto + 4 decimales, sin signo (20 caracteres).
export function valorSinSigno(valor: number | string | null | undefined): string {
  const n = Math.abs(Number(valor) || 0)
  const [enteros, decimales] = n.toFixed(4).split('.')
  if (enteros.length > 15) {
    throw new Error(`Valor ${valor} excede el máximo de 15 dígitos enteros`)
  }
  return `${enteros.padStart(15, '0')}.${decimales}`
}

export const CERO_VALOR_SIN_SIGNO = valorSinSigno(0)

// Formato Siesa para porcentajes (activos fijos, adopción NIIF):
// 3 enteros + punto + 6 decimales, sin signo (10 caracteres).
export function porcentaje(valor: number | string | null | undefined): string {
  const n = Math.abs(Number(valor) || 0)
  const [enteros, decimales] = n.toFixed(6).split('.')
  if (enteros.length > 3) {
    throw new Error(`Porcentaje ${valor} excede el máximo de 3 dígitos enteros`)
  }
  return `${enteros.padStart(3, '0')}.${decimales}`
}

// F2631_COSTO_ADQ_ORIG del plano de adopción NIIF es un caso especial: en cero
// significa "respetar el valor actual" y en los planos reales de referencia se
// escribe como 20 ceros planos, sin el punto decimal que sí llevan los demás
// campos "valor" cuando están en cero.
export function valorSentinelCero(valor: number | string | null | undefined): string {
  const n = Number(valor) || 0
  if (n === 0) return '0'.repeat(20)
  return valorSinSigno(n)
}

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
