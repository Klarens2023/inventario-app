'use client'

// Piezas compartidas entre los formularios de generación de planos
// (Saldos iniciales, Activos Fijos, Adopción NIIF).

export interface ColumnaDef<T> {
  campo: keyof T
  etiqueta: string
  numero?: boolean
  ancho?: number
}

export function TablaEditable<T extends object>({
  columnas, filas, setFilas, filaVacia,
}: {
  columnas: ColumnaDef<T>[]
  filas: T[]
  setFilas: (filas: T[]) => void
  filaVacia: () => T
}) {
  function cambiar(i: number, campo: keyof T, valor: string, esNumero?: boolean) {
    const copia = filas.slice()
    const fila = { ...copia[i] } as Record<string, string | number>
    fila[campo as string] = esNumero ? Number(valor.replace(',', '.')) || 0 : valor
    copia[i] = fila as T
    setFilas(copia)
  }
  function agregar() { setFilas([...filas, filaVacia()]) }
  function eliminar(i: number) { setFilas(filas.filter((_, idx) => idx !== i)) }

  return (
    <div>
      <div style={{ overflow: 'auto', maxHeight: 480, border: '1px solid var(--border)', borderRadius: 8 }}>
        <table className="inv-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={String(c.campo)} style={{ minWidth: c.ancho ?? 120 }}>{c.etiqueta}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={columnas.length + 1} style={{ textAlign: 'center', color: 'var(--text2)', padding: 24 }}>
                Sin filas. Importe un Excel o agregue filas manualmente.
              </td></tr>
            )}
            {filas.map((fila, i) => (
              <tr key={i}>
                {columnas.map((c) => (
                  <td key={String(c.campo)}>
                    <input
                      value={String(fila[c.campo] ?? '')}
                      onChange={(e) => cambiar(i, c.campo, e.target.value, c.numero)}
                    />
                  </td>
                ))}
                <td>
                  <button className="btn btn-danger" onClick={() => eliminar(i)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn" onClick={agregar}>+ Agregar fila</button>
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>{filas.length} fila(s)</span>
      </div>
    </div>
  )
}

export function descargarBlob(contenido: BlobPart | Uint8Array, nombre: string, tipo: string) {
  const blob = new Blob([contenido as BlobPart], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
