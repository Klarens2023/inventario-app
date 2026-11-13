// Existencias de inventario de Siesa (consulta API_v2_Inventarios_InvFecha) para el reporte de necesidad
// por producto. Sin dependencias para poder probarlo (tests/inventario-cen.test.ts).
//
// Cómo leer la consulta (verificado el 13/11/2026 contra el informe "existencia a la fecha" de Siesa:
// 3.220 de 3.220 referencia+bodega iguales):
//   - Trae una fila por ítem + bodega + extensión + ubicación + LOTE.
//   - En los ítems que manejan lote, además de una fila por lote trae una fila SIN lote con el total.
//     Si se suman todas, la existencia sale el doble: se toma la fila sin lote y, si no la hay, la suma
//     de los lotes.

export interface ExistenciaItem {
  f120_id: number
  unidad: string // unidad de inventario de Siesa (UND, KG, GRM...)
  existencia: number
  comprometida: number
  porBodega: Record<string, number>
}

const txt = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => Number(v) || 0

/** Existencia por ítem de Siesa (todas sus extensiones), opcionalmente solo de algunas bodegas. */
export function existenciasPorItem(filas: Record<string, unknown>[], bodegas?: string[]): Map<number, ExistenciaItem> {
  const soloBodegas = bodegas?.length ? new Set(bodegas) : null
  // Grupo = ítem + bodega + extensiones + ubicación: total (fila sin lote) o suma de lotes
  const grupos = new Map<string, { item: number; bodega: string; unidad: string; total: [number, number] | null; lotes: [number, number] }>()
  for (const f of filas) {
    const item = num(f.f120_id), bodega = txt(f.f150_id)
    if (!item || (soloBodegas && !soloBodegas.has(bodega))) continue
    const clave = [item, bodega, txt(f.f121_id_ext1_detalle), txt(f.f121_id_ext2_detalle), txt(f.f400_id_ubicacion_aux)].join('|')
    const g = grupos.get(clave) ?? { item, bodega, unidad: txt(f.f120_id_unidad_inventario).toUpperCase(), total: null, lotes: [0, 0] }
    const cant: [number, number] = [num(f.f400_cant_existencia_1), num(f.f400_cant_comprometida_1)]
    if (txt(f.f400_id_lote) === '') g.total = g.total ? [g.total[0] + cant[0], g.total[1] + cant[1]] : cant
    else g.lotes = [g.lotes[0] + cant[0], g.lotes[1] + cant[1]]
    grupos.set(clave, g)
  }
  const items = new Map<number, ExistenciaItem>()
  for (const g of Array.from(grupos.values())) {
    const [existencia, comprometida] = g.total ?? g.lotes
    const x = items.get(g.item) ?? { f120_id: g.item, unidad: g.unidad, existencia: 0, comprometida: 0, porBodega: {} }
    x.existencia += existencia; x.comprometida += comprometida
    x.porBodega[g.bodega] = (x.porBodega[g.bodega] ?? 0) + existencia
    items.set(g.item, x)
  }
  for (const x of Array.from(items.values())) {
    x.existencia = Math.round(x.existencia * 10000) / 10000
    for (const b of Object.keys(x.porBodega)) if (!x.porBodega[b]) delete x.porBodega[b]
  }
  return items
}

/** Condición de la consulta para unos ítems, solo filas con existencia (sin filtro tarda ~2 min). */
export function condicionInventario(items: number[]): string | null {
  const lista = Array.from(new Set(items.filter(i => Number.isInteger(i) && i > 0)))
  if (!lista.length) return null
  return `f120_id IN (${lista.join(',')}) AND f400_cant_existencia_1 <> 0`
}
