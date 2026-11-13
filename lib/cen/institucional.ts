// Pedidos institucionales: pedidos que ya se crearon directamente en Siesa (no llegan por EDI) y se agregan
// como órdenes para contarlos en una ruta (relación de despacho, totales y reportes). No se envían a Siesa:
// entran con estado 'enviado' y su número de pedido.
//
// Sin dependencias para poder probarlo (tests/institucional-cen.test.ts); la consulta a Siesa y la base
// están en ./pedidosInstitucionales.

// Valores fijos con que se guardan en cen_ordenes (ean_comprador también es la "cadena" Institucional).
export const FUENTE_INSTITUCIONAL = 'institucional'
export const COMPRADOR_INSTITUCIONAL = 'INSTITUCIONAL'
// Antigüedad máxima (días) de los pedidos que se pueden traer.
export const DIAS_INSTITUCIONAL = 8
// Líneas cuyo ítem no está en el maestro de productos: se guardan con este prefijo + f120_id.
export const PREFIJO_ITEM = 'SIESA-'

// f430_ind_estado del pedido de venta en Siesa
export const ESTADOS_PEDIDO_SIESA: Record<number, string> = {
  0: 'En elaboración', 1: 'Retenido', 2: 'Aprobado', 3: 'Comprometido', 4: 'Cumplido', 9: 'Anulado',
}

export interface LineaPedidoSiesa {
  f120_id: number
  referencia: string
  descripcion: string
  unidad: 'UND' | 'KG'
  cantidad: number
  precio: number
  bruto: number
  impuesto: number
  neto: number
}

export interface PedidoSiesaResumen {
  id: string // "CO|TIPO|CONSEC": identifica el pedido para agregarlo
  pedido: string // "PVK-16208"
  co: string
  tipo: string
  consec: number
  fecha: string // AAAA-MM-DD
  fecha_entrega: string | null
  creado: string | null // fecha y hora de creación en Siesa (hora de Colombia, sin zona)
  usuario: string | null
  nit: string
  sucursal: string
  ciudad: string // "DD-CCC" (departamento-ciudad, códigos DANE) del punto de envío; si no viene, el de la sucursal
  razon_social: string
  referencia: string // documento de referencia (OC del cliente, si la tiene)
  notas: string
  estado: number
  estado_label: string
  lineas: LineaPedidoSiesa[]
  unidades: number
  valor: number // sin impuestos
}

const txt = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => Number(v) || 0
const fecha = (v: unknown) => (txt(v).slice(0, 10) || null)

// Fecha AAAA-MM-DD → AAAAMMDD (formato que acepta la consulta de Siesa)
const compacta = (f: string) => f.replace(/-/g, '')

// Condición para API_v2_Ventas_Pedidos según lo que se escribe en el buscador:
//   "PVK-16208" / "PVK16208" → ese pedido · solo dígitos → NIT, número de pedido o documento de referencia ·
//   texto (3+ letras) → razón social que lo contenga. Siempre: pedidos no anulados desde la fecha dada.
// null si la búsqueda es muy corta.
export function condicionBusqueda(texto: string, desde: string): string | null {
  const limpio = texto.trim().toUpperCase().replace(/['"%_;\\]/g, '').replace(/\s+/g, ' ')
  const base = `f430_id_fecha >= ''${compacta(desde)}'' AND f430_ind_estado <> 9`
  const pedido = limpio.match(/^([A-Z]{2,4})[-\s]?(\d{1,9})$/)
  if (pedido) return `${base} AND f430_id_tipo_docto = ''${pedido[1]}'' AND f430_consec_docto = ${Number(pedido[2])}`
  if (/^\d{1,15}$/.test(limpio)) {
    const opciones = [`f200_nit_pedido_fact = ''${limpio}''`, `f430_num_docto_referencia = ''${limpio}''`]
    if (limpio.length <= 9) opciones.push(`f430_consec_docto = ${Number(limpio)}`)
    return `${base} AND (${opciones.join(' OR ')})`
  }
  if (limpio.replace(/[^A-Z0-9ÁÉÍÓÚÑ]/g, '').length < 3) return null
  return `${base} AND f200_razon_social_pedido_fact LIKE ''%${limpio}%''`
}

// ── Institucionales automáticos ────────────────────────────────────────────────────────────────
// En cada sincronización se traen solos los pedidos PVK de los clientes institucionales configurados
// (tabla cen_clientes_institucionales) cuyo punto de envío está en una de las ciudades del cliente: un
// mismo cliente tiene sucursales en otras ciudades que no van en la ruta (ej. Atlantic en Bogotá).

/** Tipo de documento de los pedidos institucionales que se traen solos. */
export const TIPO_INSTITUCIONAL = 'PVK'

/** Ciudades (códigos DANE departamento-ciudad, como los devuelve Siesa) con su nombre. */
export const CIUDADES: Record<string, string> = {
  '08-001': 'Barranquilla', '08-758': 'Soledad', '08-433': 'Malambo', '08-296': 'Galapa', '08-573': 'Puerto Colombia',
  '13-001': 'Cartagena de Indias', '13-836': 'Turbaco',
  '47-001': 'Santa Marta', '47-189': 'Ciénaga',
  '44-001': 'Riohacha', '44-035': 'Albania', '44-430': 'Maicao',
  '20-001': 'Valledupar', '20-250': 'El Paso',
  '23-001': 'Montería', '70-001': 'Sincelejo', '11-001': 'Bogotá',
}
export const nombreCiudad = (codigo: string) => CIUDADES[codigo] ?? codigo

/** "08", "1" → "08-001"; null si falta algún código. */
export function codigoCiudad(depto: unknown, ciudad: unknown): string | null {
  const d = txt(depto), c = txt(ciudad)
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,3}$/.test(c)) return null
  return `${d.padStart(2, '0')}-${c.padStart(3, '0')}`
}

export interface ClienteInstitucional { nit: string; nombre: string; ciudades: string[]; ruta: string; activo: boolean }

const soloDigitos = (v: string) => v.replace(/\D/g, '')

/** El cliente configurado al que corresponde el pedido (por NIT y ciudad del punto de envío), o null. */
export function clienteDelPedido(p: Pick<PedidoSiesaResumen, 'nit' | 'ciudad' | 'tipo'>, clientes: ClienteInstitucional[]): ClienteInstitucional | null {
  if (p.tipo !== TIPO_INSTITUCIONAL || !p.ciudad) return null
  const nit = soloDigitos(p.nit)
  return clientes.find(c => c.activo && soloDigitos(c.nit) === nit && c.ciudades.includes(p.ciudad)) ?? null
}

/** Condición para API_v2_Ventas_Pedidos: pedidos PVK no anulados de esos NIT desde la fecha dada. */
export function condicionAutomatica(nits: string[], desde: string): string | null {
  const lista = Array.from(new Set(nits.map(soloDigitos).filter(n => n.length >= 5 && n.length <= 15)))
  if (!lista.length) return null
  return `f430_id_fecha >= ''${compacta(desde)}'' AND f430_ind_estado <> 9 AND f430_id_tipo_docto = ''${TIPO_INSTITUCIONAL}''` +
    ` AND f200_nit_pedido_fact IN (${lista.map(n => `''${n}''`).join(',')})`
}

// Condición para traer un pedido puntual (al agregarlo se vuelve a leer de Siesa, no se confía en el navegador).
export function condicionPedido(id: string): string | null {
  const m = id.match(/^([A-Z0-9]{1,3})\|([A-Z]{1,4})\|(\d{1,9})$/)
  if (!m) return null
  return `f430_id_co = ''${m[1]}'' AND f430_id_tipo_docto = ''${m[2]}'' AND f430_consec_docto = ${Number(m[3])}`
}

// Cada fila de la consulta es una línea del pedido: se agrupan por pedido (CO + tipo + número).
// Ordenados del más reciente al más antiguo.
export function agruparPedidos(filas: Record<string, unknown>[]): PedidoSiesaResumen[] {
  const m = new Map<string, PedidoSiesaResumen>()
  for (const f of filas) {
    const co = txt(f.f430_id_co), tipo = txt(f.f430_id_tipo_docto), consec = num(f.f430_consec_docto)
    const id = `${co}|${tipo}|${consec}`
    let p = m.get(id)
    if (!p) {
      const estado = num(f.f430_ind_estado)
      p = {
        id, pedido: `${tipo}-${consec}`, co, tipo, consec,
        fecha: fecha(f.f430_id_fecha) ?? '', fecha_entrega: fecha(f.f430_fecha_entrega), creado: txt(f.f430_fecha_ts_creacion).slice(0, 19) || null,
        usuario: txt(f.f430_usuario_creacion) || null,
        nit: txt(f.f200_nit_pedido_fact), sucursal: txt(f.f430_id_sucursal_pedido_fact), razon_social: txt(f.f200_razon_social_pedido_fact),
        ciudad: codigoCiudad(f.f015_id_depto_pe, f.f015_id_ciudad_pe) ?? codigoCiudad(f.f015_id_depto_fact, f.f015_id_ciudad_fact) ?? '',
        referencia: txt(f.f430_num_docto_referencia), notas: txt(f.f430_notas),
        estado, estado_label: ESTADOS_PEDIDO_SIESA[estado] ?? `Estado ${estado}`,
        lineas: [], unidades: 0, valor: 0,
      }
      m.set(id, p)
    }
    if (f.f120_id == null) continue
    const linea: LineaPedidoSiesa = {
      f120_id: num(f.f120_id), referencia: txt(f.f120_referencia), descripcion: txt(f.f120_descripcion),
      unidad: txt(f.f431_id_unidad_medida).toUpperCase() === 'KG' ? 'KG' : 'UND',
      cantidad: num(f.f431_cant1_pedida), precio: num(f.f431_precio_unitario_base),
      bruto: num(f.f431_vlr_bruto), impuesto: num(f.f431_vlr_imp), neto: num(f.f431_vlr_neto),
    }
    p.lineas.push(linea)
    p.unidades += linea.cantidad
    p.valor += linea.bruto
  }
  return Array.from(m.values()).sort((a, b) => (b.creado ?? b.fecha).localeCompare(a.creado ?? a.fecha) || b.consec - a.consec)
}

export interface ProductoMaestro { ean: string; peso_kg: number | null }

export interface OrdenInstitucional {
  numero_orden: string
  fecha_orden: string
  fecha_entrega: string | null
  nit: string
  sucursal: string
  razon_social: string
  total_unidades: number
  valor_total: number
  peso_kg: number | null // null si algún producto no tiene peso en el maestro
  lineas: { nro_linea: number; ean_item: string; cod_comprador: string; descripcion: string; cantidad: number; precio: number; iva: number | null; unidad: 'UND' | 'KG' }[]
}

// Orden que se guarda para un pedido institucional. Cada línea se cruza con el maestro de productos por el
// ítem de Siesa (así suma peso y cajas en los reportes); si no está, queda como "SIESA-<ítem>".
export function armarOrdenInstitucional(p: PedidoSiesaResumen, maestro: Map<number, ProductoMaestro>): OrdenInstitucional {
  let peso: number | null = 0
  const lineas = p.lineas.map((l, i) => {
    const prod = maestro.get(l.f120_id)
    // Las líneas en KG ya traen el peso; las demás, cantidad × peso unitario del maestro
    const kg = l.unidad === 'KG' ? l.cantidad : prod?.peso_kg != null ? l.cantidad * prod.peso_kg : null
    peso = peso === null || kg === null ? null : peso + kg
    return {
      nro_linea: i + 1,
      ean_item: prod?.ean ?? `${PREFIJO_ITEM}${l.f120_id}`,
      cod_comprador: l.referencia.slice(0, 35),
      descripcion: l.descripcion.slice(0, 200),
      cantidad: l.cantidad,
      // Sin IVA, como el valor de la orden (el precio base de Siesa puede traer el impuesto incluido)
      precio: l.cantidad > 0 ? Math.round((l.bruto / l.cantidad) * 10000) / 10000 : l.precio,
      iva: l.bruto > 0 ? Math.round((l.impuesto / l.bruto) * 100) : null,
      unidad: l.unidad,
    }
  })
  return {
    numero_orden: p.pedido, fecha_orden: p.fecha, fecha_entrega: p.fecha_entrega ?? p.fecha,
    nit: p.nit.slice(0, 15), sucursal: p.sucursal.slice(0, 3), razon_social: p.razon_social.slice(0, 100),
    total_unidades: Math.round(p.unidades * 100) / 100, valor_total: Math.round(p.valor * 100) / 100,
    peso_kg: peso === null ? null : Math.round((peso as number) * 1000) / 1000,
    lineas,
  }
}
