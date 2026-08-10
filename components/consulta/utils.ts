export function fmt(n: number, prefix = '$') {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const s = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
  return (n < 0 ? `-${prefix}` : prefix) + s
}

// Evalúa expresiones como "4+6+97" → "107" o "1+5+2*5" → "16" (la
// multiplicación tiene prioridad sobre la suma/resta, como es normal).
export function evaluarConteo(expr: string): string {
  const clean = expr.replace(/\s/g, '')
  if (!clean) return ''
  if (!/[+\-*]/.test(clean)) return clean
  // Solo permite dígitos, puntos, +, - y *
  if (!/^[\d.+\-*]+$/.test(clean)) return clean
  try {
    // Un "-" al inicio (ej. "-5+3") se trata como "0-5+3"
    const normalizado = clean.startsWith('-') ? `0${clean}` : clean
    const tokens = normalizado.match(/\d+\.?\d*|[+\-*]/g)
    if (!tokens || tokens.length === 0) return clean

    // Primera pasada: resolver multiplicaciones (mayor precedencia), dejando
    // solo números separados por + y -.
    const terminos: string[] = []
    let i = 0
    while (i < tokens.length) {
      let valor = Number(tokens[i])
      i++
      while (tokens[i] === '*') {
        valor *= Number(tokens[i + 1])
        i += 2
      }
      terminos.push(String(valor))
      if (i < tokens.length && (tokens[i] === '+' || tokens[i] === '-')) {
        terminos.push(tokens[i])
        i++
      }
    }

    // Segunda pasada: sumar/restar de izquierda a derecha.
    let total = Number(terminos[0])
    for (let j = 1; j < terminos.length; j += 2) {
      const val = Number(terminos[j + 1])
      total = terminos[j] === '+' ? total + val : total - val
    }

    if (isNaN(total)) return clean
    return total % 1 === 0 ? String(total) : String(Math.round(total * 100) / 100)
  } catch { return clean }
}
