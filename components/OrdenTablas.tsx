'use client'
import { useEffect } from 'react'
import { ordenar, type Direccion } from '@/lib/ordenTabla'

// Orden por columnas para TODAS las tablas de la app, las de hoy y las que se creen después, sin tocar
// cada una: se monta una vez en el layout y escucha los clics en los encabezados (<thead><th>).
//   1.er clic: ascendente ▲ · 2.º: descendente ▼ · 3.º: vuelve al orden original.
// Ordena las filas de cada <tbody> de esa tabla por el texto visible de la celda (la primera línea),
// detectando si la columna es de fechas, números o texto (lib/ordenTabla.ts). El <tfoot> no se mueve.
//
// Para controlar una tabla en particular:
//   - data-sin-orden en el <table> o en un <th>: esa tabla o columna no se ordena.
//   - data-orden="valor" en un <td>: valor a usar para ordenar en vez del texto visible.
// Una fila de detalle (una sola celda con colSpan, como las que se despliegan bajo otra fila) se mueve
// junto con la fila de arriba. Si React vuelve a pintar las filas (datos nuevos), se reaplica el orden.

type Estado = { col: number; dir: Direccion; observador: MutationObserver }
const estados = new WeakMap<HTMLTableElement, Estado>()

const IGNORAR = 'input, button, select, textarea, a, label, [role="button"]'

/** Posición de la columna de un th (sumando colSpan de los anteriores), o null si no se puede ordenar. */
function columnaDe(th: HTMLTableCellElement): number | null {
  const fila = th.parentElement as HTMLTableRowElement
  const thead = fila.parentElement as HTMLTableSectionElement
  // Con varios niveles de encabezado solo se ordena desde la última fila (la de las columnas reales)
  if (thead.rows[thead.rows.length - 1] !== fila) return null
  let col = 0
  for (const c of Array.from(fila.cells)) { if (c === th) return col; col += c.colSpan }
  return null
}

/** Celda de la fila que ocupa la columna `col`. */
function celdaEn(fila: HTMLTableRowElement, col: number): HTMLTableCellElement | null {
  let i = 0
  for (const c of Array.from(fila.cells)) { if (col >= i && col < i + c.colSpan) return c; i += c.colSpan }
  return null
}

function valorDe(celda: HTMLTableCellElement | null): string {
  if (!celda) return ''
  const propio = celda.getAttribute('data-orden')
  if (propio !== null) return propio
  // Solo la primera línea: las celdas suelen traer un subtítulo debajo (ciudad, fecha de la OC, etc.)
  const texto = celda.innerText || celda.textContent || ''
  return texto.split('\n').map(s => s.trim()).find(Boolean) ?? ''
}

/** Las filas de un tbody en bloques: cada fila con las filas de detalle que tiene debajo. */
function bloques(tbody: HTMLTableSectionElement): HTMLTableRowElement[][] {
  const res: HTMLTableRowElement[][] = []
  for (const fila of Array.from(tbody.rows)) {
    const esDetalle = fila.cells.length === 1 && fila.cells[0].colSpan > 1
    if (esDetalle && res.length) res[res.length - 1].push(fila)
    else res.push([fila])
  }
  return res
}

function aplicar(tabla: HTMLTableElement, col: number | null, dir: Direccion | null) {
  for (const tbody of Array.from(tabla.tBodies)) {
    const bs = bloques(tbody)
    // Orden original: la posición que tenía cada fila la primera vez que se ordenó la tabla
    bs.forEach((b, i) => { if (!b[0].dataset.ordenOriginal) b[0].dataset.ordenOriginal = String(i) })
    const orden = col === null || !dir
      ? bs.map((b, i) => i).sort((i, j) => Number(bs[i][0].dataset.ordenOriginal) - Number(bs[j][0].dataset.ordenOriginal))
      : ordenar(bs.map(b => valorDe(celdaEn(b[0], col))), dir)
    const frag = document.createDocumentFragment()
    for (const i of orden) for (const f of bs[i]) frag.appendChild(f)
    tbody.appendChild(frag)
  }
}

function marcarEncabezado(tabla: HTMLTableElement, th: HTMLTableCellElement | null, dir: Direccion | null) {
  tabla.querySelectorAll('thead th[aria-sort]').forEach(t => t.removeAttribute('aria-sort'))
  if (th && dir) th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending')
}

function alHacerClic(e: MouseEvent) {
  const objetivo = e.target as HTMLElement | null
  const th = objetivo?.closest?.('thead th') as HTMLTableCellElement | null
  if (!th || objetivo!.closest(IGNORAR) || th.hasAttribute('data-sin-orden')) return
  const tabla = th.closest('table') as HTMLTableElement | null
  if (!tabla || tabla.hasAttribute('data-sin-orden') || !th.textContent?.trim()) return
  const col = columnaDe(th)
  if (col === null) return

  const previo = estados.get(tabla)
  previo?.observador.disconnect()
  // asc → desc → original
  const dir: Direccion | null = previo?.col !== col ? 'asc' : previo.dir === 'asc' ? 'desc' : null
  aplicar(tabla, col, dir)
  marcarEncabezado(tabla, th, dir)
  if (!dir) { estados.delete(tabla); return }

  // Si React cambia las filas (llegan datos nuevos, se despliega un detalle), se vuelve a ordenar
  const observador = new MutationObserver(() => {
    if (!tabla.isConnected) { observador.disconnect(); estados.delete(tabla); return }
    aplicar(tabla, col, dir)
    observador.takeRecords() // descarta los cambios que acaba de hacer el propio orden (si no, se repetiría sin fin)
  })
  for (const tbody of Array.from(tabla.tBodies)) observador.observe(tbody, { childList: true })
  estados.set(tabla, { col, dir, observador })
}

export function OrdenTablas() {
  useEffect(() => {
    document.addEventListener('click', alHacerClic)
    return () => document.removeEventListener('click', alHacerClic)
  }, [])
  return null
}
