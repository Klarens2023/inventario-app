// Cómo se comparan los valores al ordenar una tabla por una columna (ver components/OrdenTablas.tsx).
// Funciones puras, sin DOM, para poder probarlas (tests/orden-tabla.test.ts).
//
// Cada columna se ordena según lo que contiene: si todos sus valores son fechas, por fecha; si todos
// son números (formato colombiano: 1.234.567,89, con $ o unidades como "kg"), por número; si no,
// como texto (sin distinguir mayúsculas ni tildes, y "PVK-9" antes que "PVK-10"). Las celdas vacías
// o con "—" van siempre al final.

export type TipoColumna = 'fecha' | 'numero' | 'texto'
export type Direccion = 'asc' | 'desc'

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
}

/** Celda sin dato: vacía o con un guion como marcador. */
export function esVacio(texto: string): boolean {
  return /^[\s—–\-]*$/.test(texto)
}

/**
 * Fecha (y hora, si la trae) como número para comparar, o null si el texto no es una fecha.
 * Acepta 2026-11-06, 2026-11-06T13:29, 06/11/2026, 06/11/2026 13:29 y "vie, 6 de nov" (de 2026).
 */
export function aFecha(texto: string, anioPorDefecto = new Date().getFullYear()): number | null {
  const t = texto.trim()
  const hora = (h?: string, m?: string) => (h ? Number(h) * 60 + Number(m ?? 0) : 0)
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/)
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 60000 + hora(m[4], m[5])
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/)
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 60000 + hora(m[4], m[5])
  m = t.match(/^(?:[a-záéíóú]{3,9}\.?,?\s+)?(\d{1,2})\s+de\s+([a-z]{3})[a-z]*\.?(?:\s+(?:de\s+)?(\d{4}))?/i)
  if (m && MESES[m[2].toLowerCase()]) return Date.UTC(m[3] ? +m[3] : anioPorDefecto, MESES[m[2].toLowerCase()] - 1, +m[1]) / 60000
  return null
}

/**
 * Número en formato colombiano, o null si no lo es. "$ 82.805.760" → 82805760, "24.883,2 kg" → 24883.2,
 * "-15%" → -15. Un número seguido de otra cosa que no sea una unidad corta ("900480569/010") no es número.
 */
export function aNumero(texto: string): number | null {
  const m = texto.trim().match(/^([-−]?)\s*\$?\s*([-−]?)(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?\s*([a-zA-Z%°]{0,6}\.?)$/)
  if (!m) return null
  const n = Number(m[3].replace(/\./g, '') + (m[4] ? '.' + m[4].slice(1) : ''))
  return (m[1] || m[2]) ? -n : n
}

/** Tipo de la columna según sus valores no vacíos. */
export function tipoColumna(valores: string[], anio?: number): TipoColumna {
  const llenos = valores.filter(v => !esVacio(v))
  if (!llenos.length) return 'texto'
  if (llenos.every(v => aFecha(v, anio) !== null)) return 'fecha'
  if (llenos.every(v => aNumero(v) !== null)) return 'numero'
  return 'texto'
}

const colador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

/** Compara dos valores de una columna; los vacíos quedan al final en cualquier dirección. */
export function comparar(a: string, b: string, tipo: TipoColumna, dir: Direccion, anio?: number): number {
  const va = esVacio(a), vb = esVacio(b)
  if (va || vb) return va === vb ? 0 : va ? 1 : -1
  const signo = dir === 'asc' ? 1 : -1
  if (tipo === 'fecha') return signo * ((aFecha(a, anio) ?? 0) - (aFecha(b, anio) ?? 0))
  if (tipo === 'numero') return signo * ((aNumero(a) ?? 0) - (aNumero(b) ?? 0))
  return signo * colador.compare(a.trim(), b.trim())
}

/** Índices de `valores` en el orden pedido; los empates conservan su orden original. */
export function ordenar(valores: string[], dir: Direccion, anio?: number): number[] {
  const tipo = tipoColumna(valores, anio)
  return valores.map((v, i) => i).sort((i, j) => comparar(valores[i], valores[j], tipo, dir, anio) || i - j)
}
