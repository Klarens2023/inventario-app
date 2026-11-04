// Cálculos del pedido de Siesa para una orden EDI, sin base de datos ni API:
// bodega, precios vigentes, fecha de entrega y el JSON del conector
// API_v1_Ventas_Comercial_PedidoVenta. Los usa lib/cen/pedidoSiesa.ts (que
// consulta la base y Siesa) y se prueban en tests/edi-calculos.test.ts.
// Reglas del JSON: ver el encabezado de pedidoSiesa.ts.

export const PUNTO_ENVIO = '001'
export const BODEGA_POR_DEFECTO = '00110'

export const aaaammdd = (iso: string) => iso.replace(/-/g, '')
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000)
// Cantidades y precios como texto, con máximo 4 decimales
const txt = (v: number) => String(Math.round(v * 10000) / 10000)

/** Línea de la orden como la carga pedidoSiesa.ts (con el ítem de Siesa ya cruzado). */
export interface LineaPedido {
  nro_linea: number
  ean_item: string
  cod_comprador: string | null
  cantidad: number
  precio: number
  f120_id: string | number | null
  extension1: string | null
  unidad_orden?: string | null // unidad en que viene la orden: 'UND' o 'KG'
  unidad_item?: string | null  // unidad de inventario del ítem en Siesa (ej. 'UND', 'KG')
  peso_kg?: number | null      // peso de una unidad (Productos): factor para pasar unidades a kilos
  descripcion?: string | null  // como llegó en la orden (o la de Productos)
  // Después de convertirLineas: unidad del pedido y lo que traía la orden
  unidad?: 'UND' | 'KG'
  cantidad_orden?: number
  precio_orden?: number
}

/** Códigos de barras de la orden sin ítem de Siesa, uno por código, con las líneas en que aparecen. */
export function productosSinItem(lineas: LineaPedido[]): { ean: string; descripcion: string | null; peso_kg: number | null; lineas: number[] }[] {
  const porEan = new Map<string, { ean: string; descripcion: string | null; peso_kg: number | null; lineas: number[] }>()
  for (const l of lineas) {
    if (l.f120_id) continue
    const actual = porEan.get(l.ean_item) ?? { ean: l.ean_item, descripcion: l.descripcion ?? null, peso_kg: l.peso_kg ?? null, lineas: [] }
    actual.lineas.push(l.nro_linea)
    porEan.set(l.ean_item, actual)
  }
  return Array.from(porEan.values())
}

type AvisoLinea = { nivel: 'bloqueo' | 'alerta' | 'info'; mensaje: string }
const pesos = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: 2 })

/**
 * Unidad del pedido para los ítems que Siesa maneja por kilo (ej. quesillo en barra de 2.5 kg):
 *   - la orden viene en KG → se pide en KG tal como viene;
 *   - la orden viene en unidades → se pasa a KG con el peso por unidad de Productos
 *     (10 barras × 2.5 kg = 25 KG; $105.445 la barra = $42.178 el KG).
 * Los demás ítems se piden en unidades. Se revisa que el valor de cada línea no cambie con la
 * conversión (cantidad × precio de la orden = cantidad × precio del pedido): si cambia, es alerta.
 */
export function convertirLineas(lineas: LineaPedido[]): { lineas: LineaPedido[]; avisos: AvisoLinea[] } {
  const avisos: AvisoLinea[] = []
  const convertidas = lineas.map(l => {
    const ordenKg = String(l.unidad_orden ?? '').toUpperCase() === 'KG'
    const itemKg = String(l.unidad_item ?? '').trim().toUpperCase() === 'KG'
    const base = { ...l, cantidad_orden: l.cantidad, precio_orden: l.precio }
    const linea = `Línea ${l.nro_linea} (${l.ean_item})`
    if (!itemKg) {
      if (ordenKg && l.f120_id) avisos.push({ nivel: 'bloqueo', mensaje: `${linea}: la orden viene en kilos y Siesa maneja el ítem ${l.f120_id} por unidad. Revisa el producto o la orden.` })
      return { ...base, unidad: 'UND' as const }
    }
    if (ordenKg) return { ...base, unidad: 'KG' as const }
    const factor = Number(l.peso_kg)
    if (!(factor > 0)) {
      avisos.push({ nivel: 'bloqueo', mensaje: `${linea}: Siesa maneja el ítem ${l.f120_id} por kilo y la orden viene en unidades, pero el producto no tiene peso por unidad en Productos: no se puede convertir a kilos.` })
      return { ...base, unidad: 'KG' as const }
    }
    const cantidad = l.cantidad * factor, precio = l.precio / factor
    avisos.push({ nivel: 'info', mensaje: `${linea}: Siesa maneja el ítem por kilo. ${pesos(l.cantidad)} UND × ${pesos(factor)} kg = ${pesos(cantidad)} KG a $${pesos(precio)} el KG ($${pesos(l.precio)} la unidad).` })
    return { ...base, unidad: 'KG' as const, cantidad, precio }
  })
  // El valor que llega a Siesa (con los 4 decimales que se envían) debe ser el de la orden
  for (const l of convertidas) {
    const valorOrden = l.cantidad_orden * l.precio_orden
    const valorPedido = Number(txt(l.cantidad)) * Number(txt(l.precio))
    if (Math.abs(valorOrden - valorPedido) > 1) {
      avisos.push({ nivel: 'alerta', mensaje: `Línea ${l.nro_linea} (${l.ean_item}): el valor cambia al convertir a kilos: orden $${pesos(valorOrden)}, pedido $${pesos(valorPedido)}. Revisa antes de enviar.` })
    }
  }
  return { lineas: convertidas, avisos }
}

/**
 * Bodega de la sucursal. Prioridad: la que traiga Siesa en el maestro del
 * cliente/sucursal > la asignada a la sucursal en la app > la del cliente > 00110.
 */
export function elegirBodega(
  configBodega: string | null | undefined,
  puntoBodega: string | null | undefined,
  clienteSiesa: Record<string, unknown> | null | undefined,
): { bodega: string; origen: string } {
  let bodega = BODEGA_POR_DEFECTO, origen = 'por defecto'
  if (configBodega && configBodega !== BODEGA_POR_DEFECTO) { bodega = configBodega; origen = 'configuración del cliente' }
  if (puntoBodega) { bodega = puntoBodega; origen = 'sucursal (app)' }
  // Si el maestro de clientes de Siesa trae la bodega de la sucursal, esa manda.
  const campo = clienteSiesa ? Object.keys(clienteSiesa).find(k => /bodega/i.test(k) && String(clienteSiesa[k] ?? '').trim()) : undefined
  if (campo) { bodega = String(clienteSiesa![campo]).trim(); origen = `Siesa (${campo})` }
  return { bodega, origen }
}

export interface PrecioVigente { precio: number; unidad: string; activacion: string; actualizacion: string }

/**
 * Precio vigente por ítem en una lista de Siesa (filas de API_v2_ItemsPrecios,
 * que desde el 11/2026 en QA trae también los productos terminados, tipo "Item_Ext"):
 * el de activación más reciente ya activo y no inactivado; con la misma fecha de
 * activación, el actualizado más tarde. Uno por unidad (ej. el quesillo en barra
 * tiene precio por KG en la lista STO): devuelve ítem → precios vigentes por unidad.
 */
export function preciosVigentes(precios: Record<string, unknown>[], hoy: string): Map<string, PrecioVigente[]> {
  const porUnidad = new Map<string, PrecioVigente>() // "ítem|unidad" → precio
  for (const p of precios) {
    if (p.f126_fecha_inactivacion && String(p.f126_fecha_inactivacion).slice(0, 10) <= hoy) continue
    const activacion = String(p.f126_fecha_activacion ?? '').slice(0, 10)
    if (activacion > hoy) continue
    const unidad = String(p.f126_id_unidad_medida ?? 'UND').trim().toUpperCase() || 'UND'
    const actualizacion = String(p.f126_fecha_ts_actualizacion ?? '')
    const clave = `${p.f120_id}|${unidad}`
    const actual = porUnidad.get(clave)
    if (!actual || activacion > actual.activacion || (activacion === actual.activacion && actualizacion > actual.actualizacion)) {
      porUnidad.set(clave, { precio: Number(p.f126_precio), unidad, activacion, actualizacion })
    }
  }
  const vigente = new Map<string, PrecioVigente[]>()
  porUnidad.forEach((v, clave) => {
    const id = clave.slice(0, clave.lastIndexOf('|'))
    vigente.set(id, [...(vigente.get(id) ?? []), v])
  })
  return vigente
}

/**
 * Compara el precio de cada línea (en la unidad del pedido: UND, o KG después de
 * convertirLineas) con el de la lista en esa misma unidad. Diferencias de más de 50
 * centavos son alerta; las líneas sin precio en esa unidad quedan "sin verificar".
 */
export function revisarPrecios(lineas: LineaPedido[], vigente: Map<string, { precio: number; unidad: string }[]>, listaPrecio: string) {
  const diferencias: string[] = [], sinVerificar: string[] = []
  for (const l of lineas) {
    const unidad = l.unidad ?? 'UND'
    const precios = l.f120_id ? vigente.get(String(l.f120_id)) ?? [] : []
    const v = precios.find(p => p.unidad === unidad)
    const sufijo = unidad === 'UND' ? '' : `/${unidad}`
    if (!v) {
      const otra = precios[0]
      sinVerificar.push(`línea ${l.nro_linea} (${l.ean_item}) $${l.precio}${sufijo}` + (otra ? ` (la lista la tiene en ${otra.unidad} a $${otra.precio})` : ''))
    } else if (Math.abs(v.precio - l.precio) > 0.5) {
      diferencias.push(`Línea ${l.nro_linea} (${l.ean_item}): precio de la orden $${l.precio}${sufijo} ≠ lista ${listaPrecio} $${v.precio}${sufijo}. El pedido se crea con el precio de la orden.`)
    }
  }
  return { diferencias, sinVerificar }
}

/** Fecha de entrega del pedido: la de la orden, o hoy si ya pasó (o no trae). */
export function fechaEntregaPedido(fechaOrden: string | null, hoy: string): { fechaEntrega: string; dias: number; vencida: boolean } {
  const vencida = fechaOrden !== null && fechaOrden < hoy
  const fechaEntrega = !fechaOrden || vencida ? hoy : fechaOrden
  return { fechaEntrega, dias: diasEntre(hoy, fechaEntrega), vencida }
}

/** Bloqueos que dependen solo de las líneas: sin ítem de Siesa o sin precio. */
export function bloqueosDeLineas(lineas: LineaPedido[], indPrecio: string): string[] {
  const bloqueos: string[] = []
  const sinItem = lineas.filter(l => !l.f120_id)
  if (sinItem.length) bloqueos.push(`Sin ítem de Siesa asignado: ${sinItem.map(l => `línea ${l.nro_linea} (${l.ean_item})`).join(' · ')}. Asígnalo abajo, en "Productos nuevos sin ítem de Siesa" (o en Productos): el pedido se ingresa por ítem.`)
  if (indPrecio === '2' && lineas.some(l => !(l.precio > 0))) bloqueos.push('Con indicador de precio 2 todas las líneas deben traer precio mayor que 0.')
  return bloqueos
}

export interface DatosDocumento {
  orden: { numero_orden: string; fecha_orden: string | null; nit: string | null; sucursal: string | null }
  lineas: LineaPedido[]
  cia: string
  co: string
  tipoDocto: string
  consecutivo: string
  hoy: string
  fechaEntrega: string
  dias: number
  bodega: string
  listaPrecio: string
  condPago: string
  tipoCli: string
  indPrecio: string
  ext1Detalle: string
}

/** JSON del conector: Inicial, Pedidos, MovtoPedidoscomercial y Final, todo como texto. */
export function armarDocumento(d: DatosDocumento): Record<string, Record<string, string>[]> {
  const { orden, co, tipoDocto, consecutivo: consec, fechaEntrega, dias, bodega, listaPrecio, indPrecio } = d
  const base = { F_CIA: d.cia }
  const pedido: Record<string, string> = {
    F_CIA: d.cia, F_LIQUIDA_IMPUESTO: '1', F_CONSEC_AUTO_REG: '0', F_IND_CONTACTO: '1',
    f430_id_co: co, f430_id_tipo_docto: tipoDocto, f430_consec_docto: consec, f430_id_fecha: aaaammdd(d.hoy),
    f430_id_clase_docto: '502', f430_ind_estado: '0', f430_ind_backorder: '0',
    f430_id_tercero_fact: orden.nit ?? '', f430_id_sucursal_fact: orden.sucursal ?? '',
    f430_id_tercero_rem: orden.nit ?? '', f430_id_sucursal_rem: orden.sucursal ?? '',
    f430_id_tipo_cli_fact: d.tipoCli, f430_id_co_fact: co,
    f430_fecha_entrega: aaaammdd(fechaEntrega), f430_num_dias_entrega: String(dias),
    f430_num_docto_referencia: String(orden.numero_orden).slice(0, 15), f430_referencia: '', f430_id_cargue: '',
    f430_id_moneda_docto: 'COP', f430_id_moneda_conv: 'COP', f430_tasa_conv: '1', f430_id_moneda_local: 'COP', f430_tasa_local: '1',
    f430_id_cond_pago: d.condPago, f430_ind_impresion: '0',
    f430_notas: `OC EDI ${orden.numero_orden}${orden.fecha_orden ? ` del ${aaaammdd(orden.fecha_orden)}` : ''}`,
    f430_id_cli_contado: '', f430_id_punto_envio: PUNTO_ENVIO, f430_id_tercero_vendedor: '',
    f419_contacto: '', f419_direccion1: '', f419_direccion2: '', f419_direccion3: '', f419_id_pais: '', f419_id_depto: '',
    f419_id_ciudad: '', f419_id_barrio: '', f419_telefono: '', f419_fax: '', f419_cod_postal: '', f419_email: '', f419_ind_descuento: '0',
  }
  const movimientos = d.lineas.map((l, i) => ({
    F_CIA: d.cia, f431_id_co: co, f431_id_tipo_docto: tipoDocto, f431_consec_docto: consec, f431_nro_registro: String(i + 1),
    f431_id_item: l.f120_id ? String(l.f120_id) : '', f431_referencia_item: '', f431_codigo_barras: '', f431_id_ext1_detalle: l.extension1 ? d.ext1Detalle : '', f431_id_ext2_detalle: '',
    f431_id_bodega: bodega, f431_id_concepto: '501', f431_id_motivo: '01', f431_ind_obsequio: '0', f431_id_co_movto: co,
    f431_id_un_movto: '', f431_id_ccosto_movto: '', f431_id_proyecto: '',
    f431_fecha_entrega: aaaammdd(fechaEntrega), f431_num_dias_entrega: String(dias), f431_id_lista_precio: listaPrecio,
    f431_id_unidad_medida: l.unidad ?? 'UND', f431_cant_pedida_base: txt(l.cantidad), f431_cant2_pedida: '0', f431_precio_unitario: txt(l.precio),
    f431_ind_impto_asumido: '0', f431_notas: l.cod_comprador ? `Cod. comprador ${l.cod_comprador}` : '', f431_detalle: '',
    f431_ind_backorder: '5', f431_ind_precio: indPrecio, f431_id_punto_envio: PUNTO_ENVIO,
  }))
  return { Inicial: [base], Pedidos: [pedido], MovtoPedidoscomercial: movimientos, Final: [base] }
}
