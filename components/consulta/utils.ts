export function fmt(n: number, prefix = '$') {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const s = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0 })
  return (n < 0 ? `-${prefix}` : prefix) + s
}

// Evalúa expresiones como "4+6+97" → "107"
export function evaluarConteo(expr: string): string {
  const clean = expr.replace(/\s/g, '')
  if (!clean) return ''
  if (!/[+\-]/.test(clean)) return clean
  // Solo permite dígitos, puntos, + y -
  if (!/^[\d.+\-]+$/.test(clean)) return clean
  try {
    const partes = clean.split('+').map(p => p.trim()).filter(p => p !== '')
    const total = partes.reduce((sum, p) => {
      const subPartes = p.split('-').map(Number)
      return sum + subPartes.reduce((s, n, i) => i === 0 ? s + n : s - n, 0)
    }, 0)
    if (isNaN(total)) return clean
    return total % 1 === 0 ? String(total) : String(Math.round(total * 100) / 100)
  } catch { return clean }
}
