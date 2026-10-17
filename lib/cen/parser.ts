// Lectura de órdenes de compra EDI (mensaje EDIFACT ORDERS D96A / EAN008) en
// los dos formatos que llegan a los SFTP:
//   - Carvajal (CEN): EDIFACT estándar (.edi). Segmentos separados por ',
//     elementos por + y componentes por :, con ? como carácter de escape.
//   - Subrik: los mismos segmentos en ancho fijo (.hse), uno por línea, con los
//     valores separados por espacios (ej. "QTYA21  000000000040.000 NAR").
// Ambos se convierten a la misma estructura OrdenEdi.

export type FuenteEdi = 'carvajal' | 'subrik'

export interface LineaEdi {
  nroLinea: number
  eanItem: string // LIN
  codComprador: string // PIA (código del ítem en el comprador)
  descripcion: string // IMD (solo lo trae Carvajal)
  cantidad: number // QTY 21
  precio: number // PRI AAA (precio neto unitario)
  iva: number | null // TAX VAT (porcentaje)
  // Reparto por tienda cuando la orden se entrega en un CEDI (Éxito): cada
  // LOC+7 trae el EAN del local y el QTY+11 siguiente la cantidad para ese local.
  distribucion: { eanLocal: string; cantidad: number }[]
}

export interface OrdenEdi {
  numeroOrden: string // BGM
  fechaOrden: string | null // DTM 137, AAAA-MM-DD
  fechaEntrega: string | null // DTM 64: entrega más temprana (es la que va al pedido)
  fechaEntregaMax: string | null // DTM 63: entrega más tardía
  eanComprador: string // NAD BY
  eanEntrega: string // NAD DP (punto de entrega)
  eanProveedor: string // NAD SU
  lineas: LineaEdi[]
}

// "20261022" o "202610220000" → "2026-10-22"
function fecha(valor: string | undefined): string | null {
  const s = (valor ?? '').replace(/\D/g, '')
  if (s.length < 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

const numero = (v: string | undefined) => {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

// Quita ceros a la izquierda de códigos numéricos ("000000000001005857" → "1005857").
const sinCeros = (v: string | undefined) => String(v ?? '').trim().replace(/^0+(?=\d)/, '')

function validar(orden: OrdenEdi): OrdenEdi {
  if (!orden.numeroOrden) throw new Error('La orden no trae número (segmento BGM)')
  if (!orden.eanComprador) throw new Error('La orden no trae comprador (NAD BY)')
  if (!orden.eanEntrega) throw new Error('La orden no trae punto de entrega (NAD DP)')
  if (orden.lineas.length === 0) throw new Error('La orden no trae productos (LIN)')
  return orden
}

function ordenVacia(): OrdenEdi {
  return {
    numeroOrden: '', fechaOrden: null, fechaEntrega: null, fechaEntregaMax: null,
    eanComprador: '', eanEntrega: '', eanProveedor: '', lineas: [],
  }
}

// ── EDIFACT estándar (Carvajal) ──────────────────────────────────────────────

// Separa respetando el carácter de escape "?" (ej. "?+" es un + literal).
function separar(texto: string, sep: string): string[] {
  const partes: string[] = []
  let actual = ''
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (c === '?' && i + 1 < texto.length) { actual += texto[++i]; continue }
    if (c === sep) { partes.push(actual); actual = ''; continue }
    actual += c
  }
  partes.push(actual)
  return partes
}

export function parsearEdifact(contenido: string): OrdenEdi {
  const orden = ordenVacia()
  let linea: LineaEdi | null = null
  let locPendiente = ''
  const segmentos = separar(contenido.replace(/[\r\n]/g, ''), "'").filter(s => s.trim())

  for (const seg of segmentos) {
    const el = separar(seg, '+')
    const comp = (i: number) => separar(el[i] ?? '', ':')
    switch (el[0]) {
      case 'BGM': orden.numeroOrden = (el[2] ?? '').trim(); break
      case 'DTM': {
        const [calif, valor] = comp(1)
        if (calif === '137') orden.fechaOrden = fecha(valor)
        if (calif === '64') orden.fechaEntrega = fecha(valor)
        if (calif === '63') orden.fechaEntregaMax = fecha(valor)
        break
      }
      case 'NAD': {
        const ean = comp(2)[0]?.trim() ?? ''
        if (el[1] === 'BY') orden.eanComprador = ean
        if (el[1] === 'DP') orden.eanEntrega = ean
        if (el[1] === 'SU') orden.eanProveedor = ean
        break
      }
      case 'LIN':
        linea = { nroLinea: numero(el[1]), eanItem: comp(3)[0]?.trim() ?? '', codComprador: '', descripcion: '', cantidad: 0, precio: 0, iva: null, distribucion: [] }
        orden.lineas.push(linea)
        break
      case 'PIA': if (linea && !linea.codComprador) linea.codComprador = sinCeros(comp(2)[0]); break
      case 'IMD': if (linea) linea.descripcion = (comp(3)[3] ?? '').trim(); break
      case 'QTY': {
        const [calif, valor] = comp(1)
        if (linea && calif === '21') linea.cantidad = numero(valor)
        if (linea && calif === '11' && locPendiente) { linea.distribucion.push({ eanLocal: locPendiente, cantidad: numero(valor) }); locPendiente = '' }
        break
      }
      case 'LOC': if (linea && el[1] === '7') locPendiente = comp(2)[0]?.trim() ?? ''; break
      case 'PRI': { const [calif, valor] = comp(1); if (linea && calif === 'AAA') linea.precio = numero(valor); break }
      case 'TAX': if (linea && el[2] === 'VAT') linea.iva = numero(comp(5)[3]); break
    }
  }
  return validar(orden)
}

// ── Ancho fijo (Subrik) ──────────────────────────────────────────────────────

export function parsearHse(contenido: string): OrdenEdi {
  const orden = ordenVacia()
  let linea: LineaEdi | null = null
  let locPendiente = ''

  for (const cruda of contenido.split(/\r?\n/)) {
    const t = cruda.trim().split(/\s+/)
    const tag = t[0] ?? ''
    if (tag.startsWith('BGMA')) { orden.numeroOrden = tag.slice(4) || (t[1] ?? ''); continue }
    switch (tag.slice(0, 3)) {
      case 'DTM':
        if (t[1] === '137') orden.fechaOrden = fecha(t[2])
        if (t[1] === '64') orden.fechaEntrega = fecha(t[2])
        if (t[1] === '63') orden.fechaEntregaMax = fecha(t[2])
        break
      case 'NAD': {
        // "NAD BY  7701008009080   9": si no trae EAN, el siguiente valor es el calificador "9"
        const ean = t[2] && t[2].length > 1 ? t[2] : ''
        if (t[1] === 'BY') orden.eanComprador = ean
        if (t[1] === 'DP') orden.eanEntrega = ean
        if (t[1] === 'SU') orden.eanProveedor = ean
        break
      }
      case 'LIN':
        linea = { nroLinea: numero(t[1]), eanItem: t[2] ?? '', codComprador: '', descripcion: '', cantidad: 0, precio: 0, iva: null, distribucion: [] }
        orden.lineas.push(linea)
        break
      case 'PIA': if (linea && !linea.codComprador) linea.codComprador = sinCeros(t[2]); break
      case 'QTY':
        if (linea && tag.endsWith('21')) linea.cantidad = numero(t[1])
        if (linea && tag.endsWith('11') && locPendiente) { linea.distribucion.push({ eanLocal: locPendiente, cantidad: numero(t[1]) }); locPendiente = '' }
        break
      case 'LOC': if (linea && t[1] === '7') locPendiente = t[2] ?? ''; break
      case 'PRI': if (linea && t[1] === 'AAA') linea.precio = numero(t[2]); break
      case 'TAX': if (linea && tag === 'TAXG' && t.length > 1) linea.iva = numero(t[t.length - 1]); break
    }
  }
  return validar(orden)
}

// Detecta el formato por el contenido (no por la extensión).
export function parsearOrden(contenido: string): OrdenEdi {
  return contenido.trimStart().startsWith('UNB+') || contenido.includes("'UNH+")
    ? parsearEdifact(contenido)
    : parsearHse(contenido)
}
