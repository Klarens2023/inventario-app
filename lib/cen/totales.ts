// Totales de una orden EDI al guardarla (lib/cen/sincronizar.ts). Sin dependencias
// de servidor, para poder probarlo. El peso decide la ruta de despacho (reglasRuta.ts).

export function totalesOrden(
  lineas: { eanItem: string; cantidad: number; precio: number; unidad?: 'UND' | 'KG' }[],
  pesoPorEan: Map<string, number>,
): { unidades: number; valor: number; peso: number | null } {
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)
  const valor = lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)
  // Una línea pedida en kilos ya trae su peso; las de unidades se multiplican por el peso del maestro.
  // Si algún producto por unidades no está en el maestro, el peso queda vacío (no se muestra un peso incompleto).
  const todosConPeso = lineas.every(l => l.unidad === 'KG' || pesoPorEan.has(l.eanItem))
  const peso = todosConPeso
    ? lineas.reduce((s, l) => s + (l.unidad === 'KG' ? l.cantidad : l.cantidad * (pesoPorEan.get(l.eanItem) ?? 0)), 0)
    : null
  return { unidades, valor, peso }
}
