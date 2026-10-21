// Arma y envía a Siesa el pedido de venta de una orden EDI (conector
// API_v1_Ventas_Comercial_PedidoVenta). Un pedido por orden de compra.
//
// Reglas del JSON (documento "Reglas_JSON_PedidoVenta_Connekta"):
//   - Secciones Inicial, Pedidos, MovtoPedidoscomercial y Final, en ese orden.
//   - Todas las llaves aunque estén vacías y todos los valores como texto.
//   - Enteros nunca vacíos.
//   - Tipo de documento PVS (exclusivo de las órdenes EDI) con consecutivo MANUAL: F_CONSEC_AUTO_REG = "0" y
//     f430/f431_consec_docto = siguiente número, consultado en Siesa (API_v2_Ventas_Pedidos) justo antes de
//     enviar. Así cada orden queda con su número de pedido (cen_ordenes.siesa_consecutivo = "PVS-N").
//   - f430_id_fecha = fecha del día del envío; f430_id_punto_envio obligatorio.
//
// Antes de enviar se valida contra Siesa:
//   - cliente/sucursal existente y activo (API_v2_Clientes). f201_ind_estado_bloqueado NO es un
//     bloqueo: solo indica que se bloquea si supera cupo o mora; el bloqueo real lo aplica Siesa al
//     crear el pedido y se informa con los indicadores f430_ind_retenido_* del pedido creado.
//   - que la orden no tenga ya un pedido (API_v2_Ventas_Pedidos por documento de referencia)
//   - que el precio de la orden coincida con la lista del cliente (API_v2_ItemsPrecios): si no, es ALERTA
//     para revisar antes de montar, no bloquea. Esa consulta no trae los precios de los productos
//     terminados (están por extensión FN): si no encuentra el precio, también queda como alerta.
//
// Las líneas van por ítem de Siesa (f431_id_item = f120_id de cen_lineas_producto: el de la cadena o el del maestro, asignado desde
// API_v2_Items o a mano en Productos), no por código de barras: sin ítem la orden no se envía.
// Los ítems con extensión 1 (f120_id_extension1 = "FB") llevan f431_id_ext1_detalle = "FN".
import { sql } from '@/lib/db'
import { consultar, consultarTodo, condicion, enviarConector } from '@/lib/siesa/connekta'
import { asignarItemsAutomaticamente } from './itemsSiesa'

const ID_DOCUMENTO = () => process.env.SIESA_ID_DOCUMENTO_PEDIDO || '142900'
const NOMBRE_DOCUMENTO = () => process.env.SIESA_NOMBRE_DOCUMENTO_PEDIDO || 'API_v1_Ventas_Comercial_PedidoVenta'
const CIA = () => process.env.SIESA_CIA || '1'
const PUNTO_ENVIO = '001'
// Tipo de documento de los pedidos de órdenes EDI (solo se usa para estos pedidos).
export const TIPO_DOCTO = () => process.env.SIESA_TIPO_DOCTO_PEDIDO || 'PVS'
// Detalle de extensión con que se piden los ítems que manejan extensión 1 (todos los pedidos de Siesa usan FN).
const EXT1_DETALLE = () => process.env.SIESA_EXT1_DETALLE || 'FN'

export type NivelAviso = 'bloqueo' | 'alerta' | 'info'
export interface Aviso { nivel: NivelAviso; mensaje: string }

export interface PreparacionPedido {
  documento: Record<string, Record<string, string>[]>
  avisos: Aviso[]
  puedeEnviar: boolean
  resumen: { cliente: string; listaPrecio: string; condPago: string; bodega: string; origenBodega: string; tipoDocto: string; consecutivo: string; fechaEntrega: string; diasEntrega: number }
}

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // AAAA-MM-DD
const aaaammdd = (iso: string) => iso.replace(/-/g, '')
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000)
const txt = (v: number) => String(Math.round(v * 10000) / 10000)

async function cargarOrden(ordenId: number) {
  const [orden] = await sql`
    SELECT id, numero_orden, fecha_orden::text, fecha_entrega::text, nit, sucursal, razon_social, estado
    FROM cen_ordenes WHERE id = ${ordenId}
  `
  if (!orden) throw new Error('Orden no encontrada')
  const lineas = await sql`
    SELECT l.nro_linea, l.ean_item, l.cod_comprador, l.cantidad::float AS cantidad, l.precio::float AS precio, p.f120_id, i.extension1
    FROM cen_orden_lineas l JOIN cen_lineas_producto p ON p.linea_id = l.id -- producto de la cadena o del maestro
    LEFT JOIN cen_items_siesa i ON i.f120_id = p.f120_id
    WHERE l.orden_id = ${ordenId} ORDER BY l.nro_linea
  `
  return { orden, lineas }
}

// Siguiente consecutivo del tipo de documento en el CO: el mayor entre lo que ya tiene Siesa y lo que la app
// ya envió, más uno. A Siesa solo se le piden los pedidos por encima del último conocido (consulta corta).
export async function siguienteConsecutivo(co: string, tipo: string): Promise<number> {
  const [local] = await sql`
    SELECT COALESCE(MAX(split_part(siesa_consecutivo, '-', 2)::int), 0) AS n FROM cen_ordenes
    WHERE siesa_consecutivo ~ ${'^' + tipo + '-[0-9]+$'}
  `
  let mayor = Number(local?.n ?? 0)
  const enSiesa = await consultarTodo<Record<string, unknown>>('API_v2_Ventas_Pedidos',
    `${condicion('f430_id_tipo_docto', tipo)} AND ${condicion('f430_id_co', co)} AND f430_consec_docto > ${mayor}`)
  for (const p of enSiesa) mayor = Math.max(mayor, Number(p.f430_consec_docto) || 0)
  return mayor + 1
}

export async function prepararPedido(ordenId: number): Promise<PreparacionPedido> {
  await asignarItemsAutomaticamente()
  const { orden, lineas } = await cargarOrden(ordenId)
  const avisos: Aviso[] = []
  const bloqueo = (m: string) => avisos.push({ nivel: 'bloqueo', mensaje: m })
  const alerta = (m: string) => avisos.push({ nivel: 'alerta', mensaje: m })

  if (orden.estado === 'enviado') bloqueo('Esta orden ya tiene pedido en Siesa.')
  if (orden.estado === 'descartada') bloqueo('La orden está descartada.')
  if (!orden.nit) bloqueo('El punto de entrega no está asociado a una sucursal de Siesa.')

  const [config] = orden.nit ? await sql`SELECT * FROM cen_config_clientes WHERE nit = ${orden.nit}` : []
  if (orden.nit && !config) alerta(`El cliente ${orden.nit} no tiene configuración propia: se usan CO 001 y precio de la orden.`)
  const co = config?.id_co ?? '001', tipoDocto = TIPO_DOCTO(), indPrecio = config?.ind_precio ?? '2'

  // La bodega se amarra a la sucursal. Prioridad: la que traiga Siesa en el maestro del
  // cliente/sucursal > la asignada a la sucursal en la app > la del cliente > 00110.
  const [punto] = orden.nit ? await sql`SELECT bodega FROM cen_puntos_ean WHERE nit = ${orden.nit} AND sucursal = ${orden.sucursal} AND bodega IS NOT NULL LIMIT 1` : []
  let bodega = '00110', origenBodega = 'por defecto'
  if (config?.bodega && config.bodega !== '00110') { bodega = config.bodega; origenBodega = 'configuración del cliente' }
  if (punto?.bodega) { bodega = punto.bodega; origenBodega = 'sucursal (app)' }

  // ── Cliente en Siesa ──
  let listaPrecio = config?.lista_precio ?? '', condPago = config?.cond_pago ?? '', tipoCli = ''
  if (orden.nit) {
    try {
      const [cli] = await consultar<Record<string, unknown>>('API_v2_Clientes', {
        parametros: `${condicion('f200_nit', orden.nit)} AND ${condicion('f201_id_sucursal', orden.sucursal)}`,
      })
      if (!cli) bloqueo(`La sucursal ${orden.nit}/${orden.sucursal} no existe como cliente en Siesa.`)
      else {
        if (Number(cli.f201_ind_estado_activo) === 0) bloqueo(`La sucursal ${orden.nit}/${orden.sucursal} está INACTIVA en Siesa.`)
        listaPrecio ||= String(cli.f201_id_lista_precio ?? '').trim()
        condPago ||= String(cli.f201_id_cond_pago ?? '').trim()
        tipoCli = String(cli.f201_id_tipo_cli ?? '').trim()
        // Si el maestro de clientes de Siesa trae la bodega de la sucursal, esa manda.
        const campoBodega = Object.keys(cli).find(k => /bodega/i.test(k) && String(cli[k] ?? '').trim())
        if (campoBodega) { bodega = String(cli[campoBodega]).trim(); origenBodega = `Siesa (${campoBodega})` }
      }
    } catch (e) {
      bloqueo(`No se pudo consultar el cliente en Siesa: ${e instanceof Error ? e.message : e}`)
    }
  }
  if (orden.nit && origenBodega === 'por defecto') alerta(`La sucursal ${orden.nit}/${orden.sucursal} no tiene bodega asignada: se usa 00110. Asígnala en Sucursales si despacha desde otra bodega.`)
  if (!condPago) bloqueo('No hay condición de pago (ni en Siesa ni en la configuración del cliente).')
  if (indPrecio !== '0' && !listaPrecio) bloqueo('No hay lista de precios (obligatoria con indicador de precio 1 o 2).')

  // ── ¿Ya existe un pedido con esta orden de compra? ──
  if (orden.nit) {
    try {
      const pedidos = await consultar<Record<string, unknown>>('API_v2_Ventas_Pedidos', {
        parametros: `${condicion('f430_num_docto_referencia', orden.numero_orden)} AND ${condicion('f200_nit_pedido_fact', orden.nit)}`,
      })
      const vivos = pedidos.filter(p => Number(p.f430_ind_estado) !== 9) // 9 = anulado
      if (vivos.length) {
        const p = vivos[0]
        bloqueo(`Ya existe el pedido ${p.f430_id_tipo_docto}-${p.f430_consec_docto} en Siesa con la OC ${orden.numero_orden}.`)
      }
    } catch (e) {
      alerta(`No se pudo verificar si la OC ya tiene pedido en Siesa: ${e instanceof Error ? e.message : e}`)
    }
  }

  // ── Precio de la orden vs. lista del cliente (alerta para revisar, no bloquea) ──
  if (listaPrecio && indPrecio === '2') {
    const sinVerificar: string[] = []
    try {
      const precios = await consultarTodo<Record<string, unknown>>('API_v2_ItemsPrecios', condicion('f126_id_lista_precio', listaPrecio))
      // Precio vigente por ítem: el de activación más reciente ya activo y no inactivado
      const vigente = new Map<string, { precio: number; activacion: string }>()
      const hoy = hoyBogota()
      for (const p of precios) {
        if (p.f126_fecha_inactivacion && String(p.f126_fecha_inactivacion).slice(0, 10) <= hoy) continue
        const activ = String(p.f126_fecha_activacion ?? '').slice(0, 10)
        if (activ > hoy) continue
        const id = String(p.f120_id)
        if (!vigente.has(id) || activ > vigente.get(id)!.activacion) vigente.set(id, { precio: Number(p.f126_precio), activacion: activ })
      }
      for (const l of lineas) {
        const v = l.f120_id ? vigente.get(String(l.f120_id)) : undefined
        if (!v) sinVerificar.push(`línea ${l.nro_linea} (${l.ean_item}) $${l.precio}`)
        else if (Math.abs(v.precio - l.precio) > 0.5) {
          alerta(`Línea ${l.nro_linea} (${l.ean_item}): precio de la orden $${l.precio} ≠ lista ${listaPrecio} $${v.precio}. El pedido se crea con el precio de la orden.`)
        }
      }
    } catch (e) {
      sinVerificar.push(...lineas.map(l => `línea ${l.nro_linea} (${l.ean_item}) $${l.precio}`))
      console.error('Precios Siesa:', e)
    }
    if (sinVerificar.length) {
      alerta(`Siesa no tiene precio consultable en la lista ${listaPrecio} para: ${sinVerificar.join(' · ')}. La consulta de precios de Siesa no trae los productos terminados (o el producto no tiene ítem de Siesa asignado en Productos). Revisa que el precio de la orden sea el pactado antes de enviar.`)
    }
  }

  // ── Fechas ──
  const hoy = hoyBogota()
  let fechaEntrega = orden.fecha_entrega ?? hoy
  if (fechaEntrega < hoy) {
    alerta(`La fecha de entrega de la orden (${fechaEntrega}) ya pasó: el pedido se crea con entrega hoy.`)
    fechaEntrega = hoy
  }
  const dias = diasEntre(hoy, fechaEntrega)

  // ── Consecutivo manual ──
  let consecutivo = 0
  try {
    consecutivo = await siguienteConsecutivo(co, tipoDocto)
  } catch (e) {
    bloqueo(`No se pudo consultar el último consecutivo ${tipoDocto} en Siesa: ${e instanceof Error ? e.message : e}`)
  }
  const consec = String(consecutivo || 1)

  // ── Documento ──
  const base = { F_CIA: CIA() }
  const pedido: Record<string, string> = {
    F_CIA: CIA(), F_LIQUIDA_IMPUESTO: '1', F_CONSEC_AUTO_REG: '0', F_IND_CONTACTO: '1',
    f430_id_co: co, f430_id_tipo_docto: tipoDocto, f430_consec_docto: consec, f430_id_fecha: aaaammdd(hoy),
    f430_id_clase_docto: '502', f430_ind_estado: '0', f430_ind_backorder: '0',
    f430_id_tercero_fact: orden.nit ?? '', f430_id_sucursal_fact: orden.sucursal ?? '',
    f430_id_tercero_rem: orden.nit ?? '', f430_id_sucursal_rem: orden.sucursal ?? '',
    f430_id_tipo_cli_fact: tipoCli, f430_id_co_fact: co,
    f430_fecha_entrega: aaaammdd(fechaEntrega), f430_num_dias_entrega: String(dias),
    f430_num_docto_referencia: String(orden.numero_orden).slice(0, 15), f430_referencia: '', f430_id_cargue: '',
    f430_id_moneda_docto: 'COP', f430_id_moneda_conv: 'COP', f430_tasa_conv: '1', f430_id_moneda_local: 'COP', f430_tasa_local: '1',
    f430_id_cond_pago: condPago, f430_ind_impresion: '0',
    f430_notas: `OC EDI ${orden.numero_orden}${orden.fecha_orden ? ` del ${aaaammdd(orden.fecha_orden)}` : ''}`,
    f430_id_cli_contado: '', f430_id_punto_envio: PUNTO_ENVIO, f430_id_tercero_vendedor: '',
    f419_contacto: '', f419_direccion1: '', f419_direccion2: '', f419_direccion3: '', f419_id_pais: '', f419_id_depto: '',
    f419_id_ciudad: '', f419_id_barrio: '', f419_telefono: '', f419_fax: '', f419_cod_postal: '', f419_email: '', f419_ind_descuento: '0',
  }
  const movimientos = lineas.map((l, i) => ({
    F_CIA: CIA(), f431_id_co: co, f431_id_tipo_docto: tipoDocto, f431_consec_docto: consec, f431_nro_registro: String(i + 1),
    f431_id_item: l.f120_id ? String(l.f120_id) : '', f431_referencia_item: '', f431_codigo_barras: '', f431_id_ext1_detalle: l.extension1 ? EXT1_DETALLE() : '', f431_id_ext2_detalle: '',
    f431_id_bodega: bodega, f431_id_concepto: '501', f431_id_motivo: '01', f431_ind_obsequio: '0', f431_id_co_movto: co,
    f431_id_un_movto: '', f431_id_ccosto_movto: '', f431_id_proyecto: '',
    f431_fecha_entrega: aaaammdd(fechaEntrega), f431_num_dias_entrega: String(dias), f431_id_lista_precio: listaPrecio,
    f431_id_unidad_medida: 'UND', f431_cant_pedida_base: txt(l.cantidad), f431_cant2_pedida: '0', f431_precio_unitario: txt(l.precio),
    f431_ind_impto_asumido: '0', f431_notas: l.cod_comprador ? `Cod. comprador ${l.cod_comprador}` : '', f431_detalle: '',
    f431_ind_backorder: '5', f431_ind_precio: indPrecio, f431_id_punto_envio: PUNTO_ENVIO,
  }))
  const sinItem = lineas.filter(l => !l.f120_id)
  if (sinItem.length) bloqueo(`Sin ítem de Siesa asignado: ${sinItem.map(l => `línea ${l.nro_linea} (${l.ean_item})`).join(' · ')}. Asígnalo en Productos: el pedido se ingresa por ítem.`)
  if (indPrecio === '2' && lineas.some(l => !(l.precio > 0))) bloqueo('Con indicador de precio 2 todas las líneas deben traer precio mayor que 0.')

  return {
    documento: { Inicial: [base], Pedidos: [pedido], MovtoPedidoscomercial: movimientos, Final: [base] },
    avisos,
    puedeEnviar: !avisos.some(a => a.nivel === 'bloqueo'),
    resumen: {
      cliente: orden.razon_social ? `${orden.razon_social} (${orden.nit}/${orden.sucursal})` : 'Sin asociar',
      listaPrecio, condPago, bodega, origenBodega, tipoDocto, consecutivo: `${tipoDocto}-${consec}`, fechaEntrega, diasEntrega: dias,
    },
  }
}

export async function enviarPedido(ordenId: number, confirmaAlertas: boolean) {
  const prep = await prepararPedido(ordenId)
  if (!prep.puedeEnviar) return { ok: false, mensaje: 'La orden tiene bloqueos: revísalos antes de enviar.', prep }
  if (prep.avisos.some(a => a.nivel === 'alerta') && !confirmaAlertas) {
    return { ok: false, mensaje: 'Confirma que revisaste las alertas antes de enviar.', prep }
  }

  const r = await enviarConector(ID_DOCUMENTO(), NOMBRE_DOCUMENTO(), prep.documento)
  if (!r.ok) {
    await sql`UPDATE cen_ordenes SET estado = 'error', siesa_respuesta = ${JSON.stringify(r.cuerpo)}::jsonb, updated_at = NOW() WHERE id = ${ordenId}`
    return { ok: false, mensaje: `Siesa rechazó el pedido: ${r.mensaje}`, respuesta: r.cuerpo, prep }
  }

  // Número con que se creó (consecutivo manual); se confirma con el pedido recién creado en Siesa.
  let consecutivo: string | null = prep.resumen.consecutivo
  let retenido = ''
  try {
    const { orden } = await cargarOrden(ordenId)
    const pedidos = await consultar<Record<string, unknown>>('API_v2_Ventas_Pedidos', {
      parametros: `${condicion('f430_num_docto_referencia', orden.numero_orden)} AND ${condicion('f200_nit_pedido_fact', orden.nit)}`,
    })
    const p = pedidos.filter(x => Number(x.f430_ind_estado) !== 9).sort((a, b) => Number(b.f430_consec_docto) - Number(a.f430_consec_docto))[0]
    if (p) {
      consecutivo = `${p.f430_id_tipo_docto}-${p.f430_consec_docto}`
      const motivos = [['cupo', p.f430_ind_retenido_cupo], ['mora', p.f430_ind_retenido_mora], ['margen', p.f430_ind_retenido_margen],
        ['bloqueo', p.f430_ind_retenido_bloqueo], ['anticipo', p.f430_ind_retenido_anticipo]].filter(([, v]) => Number(v) === 1).map(([m]) => m)
      if (motivos.length) retenido = `Siesa dejó el pedido retenido por: ${motivos.join(', ')}.`
    }
  } catch { /* el pedido sí se creó; el consecutivo se puede ver en Siesa */ }

  await sql`
    UPDATE cen_ordenes SET estado = 'enviado', siesa_consecutivo = ${consecutivo},
           siesa_respuesta = ${JSON.stringify(r.cuerpo)}::jsonb, enviado_at = NOW(), updated_at = NOW()
    WHERE id = ${ordenId}
  `
  const mensaje = (consecutivo ? `Pedido ${consecutivo} creado en Siesa.` : 'Pedido creado en Siesa.') + (retenido ? ` ${retenido}` : '')
  return { ok: true, mensaje, consecutivo, retenido, respuesta: r.cuerpo, prep }
}

// Reversa en la app una orden ya enviada para volver a crear su pedido (ej. pedidos de prueba PVK que se rehacen
// como PVS). La API no permite anular pedidos: primero se anula en Siesa y aquí solo se confirma que ya no quede
// ningún pedido vivo con esa OC, para no duplicarlo. La orden vuelve a Pendiente y se guarda el número anterior.
export async function reversarPedido(ordenId: number): Promise<{ ok: boolean; mensaje: string }> {
  const [orden] = await sql`SELECT numero_orden, nit, estado, siesa_consecutivo FROM cen_ordenes WHERE id = ${ordenId}`
  if (!orden) return { ok: false, mensaje: 'Orden no encontrada' }
  if (orden.estado !== 'enviado') return { ok: false, mensaje: 'Solo se reversan órdenes que ya tienen pedido en Siesa.' }

  const pedidos = await consultar<Record<string, unknown>>('API_v2_Ventas_Pedidos', {
    parametros: `${condicion('f430_num_docto_referencia', orden.numero_orden)} AND ${condicion('f200_nit_pedido_fact', orden.nit)}`,
  })
  const vivos = Array.from(new Set(pedidos.filter(p => Number(p.f430_ind_estado) !== 9).map(p => `${p.f430_id_tipo_docto}-${p.f430_consec_docto}`)))
  if (vivos.length) {
    return { ok: false, mensaje: `La OC ${orden.numero_orden} todavía tiene el pedido ${vivos.join(', ')} vivo en Siesa. Anúlalo primero en Siesa y vuelve a reversar.` }
  }
  await sql`
    UPDATE cen_ordenes SET estado = ${orden.nit ? 'pendiente' : 'sin_punto'}, siesa_consecutivo = NULL, enviado_at = NULL,
           siesa_respuesta = ${JSON.stringify({ reversado_at: new Date().toISOString(), pedido_anterior: orden.siesa_consecutivo })}::jsonb,
           updated_at = NOW()
    WHERE id = ${ordenId}
  `
  return { ok: true, mensaje: `Orden reversada: el pedido ${orden.siesa_consecutivo ?? ''} está anulado en Siesa y la OC quedó pendiente para volver a enviarla.` }
}
