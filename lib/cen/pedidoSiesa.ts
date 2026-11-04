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
//     para revisar antes de montar, no bloquea. Desde 11/2026 la consulta trae también los productos
//     terminados (precio por extensión, "Item_Ext"). Si no encuentra el precio en UND (falta en la
//     lista, el producto no tiene ítem de Siesa o la lista lo tiene por KG), también queda como alerta.
//
// Las líneas van por ítem de Siesa (f431_id_item = f120_id de cen_lineas_producto: el de la cadena o el del maestro, asignado desde
// API_v2_Items o a mano en Productos), no por código de barras: sin ítem la orden no se envía.
// Los ítems con extensión 1 (f120_id_extension1 = "FB") llevan f431_id_ext1_detalle = "FN".
//
// Este archivo consulta la base y Siesa; los cálculos (bodega, precios, fechas y el JSON) están en
// ./documentoPedido, sin dependencias, para poder probarlos (tests/pedido-siesa.test.ts).
import { sql } from '@/lib/db'
import { hoyBogota } from '@/lib/fechas'
import { consultar, consultarTodo, condicion, enviarConector } from '@/lib/siesa/connekta'
import { asignarItemsAutomaticamente } from './itemsSiesa'
import {
  armarDocumento, bloqueosDeLineas, convertirLineas, elegirBodega, productosSinItem, fechaEntregaPedido, preciosVigentes, revisarPrecios, type DatosDocumento, type LineaPedido,
} from './documentoPedido'

const ID_DOCUMENTO = () => process.env.SIESA_ID_DOCUMENTO_PEDIDO || '142900'
const NOMBRE_DOCUMENTO = () => process.env.SIESA_NOMBRE_DOCUMENTO_PEDIDO || 'API_v1_Ventas_Comercial_PedidoVenta'
const CIA = () => process.env.SIESA_CIA || '1'
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
  // Códigos de barras de la orden sin ítem de Siesa: la vista previa permite asignarlo ahí mismo
  // (queda guardado en Productos para las siguientes órdenes).
  sinItem: { ean: string; descripcion: string | null; peso_kg: number | null; lineas: number[] }[]
}

async function cargarOrden(ordenId: number) {
  const [orden] = await sql`
    SELECT id, numero_orden, fecha_orden::text, fecha_entrega::text, ean_entrega, nit, sucursal, razon_social, estado
    FROM cen_ordenes WHERE id = ${ordenId}
  `
  if (!orden) throw new Error('Orden no encontrada')
  const lineas = await sql`
    SELECT l.nro_linea, l.ean_item, l.cod_comprador, l.cantidad::float AS cantidad, l.precio::float AS precio, p.f120_id, i.extension1,
           -- to_jsonb: sin la migración de la unidad (migrate-add-cen-unidad-lineas.js) todas cuentan como unidades
           COALESCE(to_jsonb(l) ->> 'unidad', 'UND') AS unidad_orden, i.unidad AS unidad_item, p.peso_kg::float AS peso_kg,
           COALESCE(NULLIF(l.descripcion, ''), p.descripcion) AS descripcion
    FROM cen_orden_lineas l JOIN cen_lineas_producto p ON p.linea_id = l.id -- producto de la cadena o del maestro
    LEFT JOIN cen_items_siesa i ON i.f120_id = p.f120_id
    WHERE l.orden_id = ${ordenId} ORDER BY l.nro_linea
  `
  return { orden, lineas: lineas as unknown as LineaPedido[] }
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
  const { orden, lineas: lineasOrden } = await cargarOrden(ordenId)
  // Ítems que Siesa maneja por kilo: la línea pasa a KG (cantidad y precio por kilo) antes de comparar precios
  const { lineas, avisos: avisosUnidad } = convertirLineas(lineasOrden)
  const avisos: Aviso[] = []
  const bloqueo = (m: string) => avisos.push({ nivel: 'bloqueo', mensaje: m })
  const alerta = (m: string) => avisos.push({ nivel: 'alerta', mensaje: m })

  if (orden.estado === 'enviado') bloqueo('Esta orden ya tiene pedido en Siesa.')
  if (orden.estado === 'descartada') bloqueo('La orden está descartada.')
  if (!orden.nit) bloqueo('El punto de entrega no está asociado a una sucursal de Siesa.')

  const [config] = orden.nit ? await sql`SELECT * FROM cen_config_clientes WHERE nit = ${orden.nit}` : []
  if (orden.nit && !config) alerta(`El cliente ${orden.nit} no tiene configuración propia: se usan CO 001 y precio de la orden.`)
  const co = config?.id_co ?? '001', tipoDocto = TIPO_DOCTO(), indPrecio = config?.ind_precio ?? '2'

  // La bodega se amarra a la sucursal (prioridades en elegirBodega).
  // Una sucursal puede tener varios EAN (tienda y CEDI): manda la bodega del EAN por el que llegó la orden.
  const [punto] = orden.nit ? await sql`
    SELECT bodega FROM cen_puntos_ean WHERE nit = ${orden.nit} AND sucursal = ${orden.sucursal} AND bodega IS NOT NULL
    ORDER BY (ean = ${orden.ean_entrega}) DESC LIMIT 1` : []

  // ── Cliente en Siesa ──
  let listaPrecio = config?.lista_precio ?? '', condPago = config?.cond_pago ?? '', tipoCli = ''
  let clienteSiesa: Record<string, unknown> | null = null
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
        clienteSiesa = cli
      }
    } catch (e) {
      bloqueo(`No se pudo consultar el cliente en Siesa: ${e instanceof Error ? e.message : e}`)
    }
  }
  const { bodega, origen: origenBodega } = elegirBodega(config?.bodega, punto?.bodega, clienteSiesa)
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
      const revision = revisarPrecios(lineas, preciosVigentes(precios, hoyBogota()), listaPrecio)
      revision.diferencias.forEach(alerta)
      sinVerificar.push(...revision.sinVerificar)
    } catch (e) {
      sinVerificar.push(...lineas.map(l => `línea ${l.nro_linea} (${l.ean_item}) $${l.precio}`))
      console.error('Precios Siesa:', e)
    }
    if (sinVerificar.length) {
      alerta(`No se pudo comparar con la lista ${listaPrecio} de Siesa: ${sinVerificar.join(' · ')}. El producto no está en la lista, no tiene ítem de Siesa asignado en Productos o la lista lo tiene en otra unidad (ej. KG). Revisa que el precio de la orden sea el pactado antes de enviar.`)
    }
  }

  // ── Fechas ──
  const hoy = hoyBogota()
  const { fechaEntrega, dias, vencida } = fechaEntregaPedido(orden.fecha_entrega, hoy)
  if (vencida) alerta(`La fecha de entrega de la orden (${orden.fecha_entrega}) ya pasó: el pedido se crea con entrega hoy.`)

  // ── Consecutivo manual ──
  let consecutivo = 0
  try {
    consecutivo = await siguienteConsecutivo(co, tipoDocto)
  } catch (e) {
    bloqueo(`No se pudo consultar el último consecutivo ${tipoDocto} en Siesa: ${e instanceof Error ? e.message : e}`)
  }
  const consec = String(consecutivo || 1)

  // ── Documento ──
  const documento = armarDocumento({
    orden: orden as DatosDocumento['orden'], lineas, cia: CIA(), co, tipoDocto, consecutivo: consec, hoy, fechaEntrega, dias,
    bodega, listaPrecio, condPago, tipoCli, indPrecio, ext1Detalle: EXT1_DETALLE(),
  })
  bloqueosDeLineas(lineas, indPrecio).forEach(bloqueo)
  avisos.push(...avisosUnidad)

  return {
    documento,
    avisos,
    puedeEnviar: !avisos.some(a => a.nivel === 'bloqueo'),
    resumen: {
      cliente: orden.razon_social ? `${orden.razon_social} (${orden.nit}/${orden.sucursal})` : 'Sin asociar',
      listaPrecio, condPago, bodega, origenBodega, tipoDocto, consecutivo: `${tipoDocto}-${consec}`, fechaEntrega, diasEntrega: dias,
    },
    sinItem: productosSinItem(lineasOrden),
  }
}

export async function enviarPedido(ordenId: number, confirmaAlertas: boolean) {
  const prep = await prepararPedido(ordenId)
  if (!prep.puedeEnviar) return { ok: false, mensaje: 'La orden tiene bloqueos: revísalos antes de enviar.', prep }
  if (prep.avisos.some(a => a.nivel === 'alerta') && !confirmaAlertas) {
    return { ok: false, mensaje: 'Confirma que revisaste las alertas antes de enviar.', prep }
  }

  // Reserva atómica de la orden antes de llamar a Siesa: dos envíos simultáneos
  // (doble clic, dos usuarios) pasaban ambos la validación de arriba y podían
  // crear dos pedidos. Solo el UPDATE que encuentra la orden aún abierta sigue;
  // mientras se envía queda en 'enviado', así que la sincronización EDI tampoco
  // la reescribe (guardarOrden omite las enviadas).
  const [reserva] = await sql`
    WITH previa AS (SELECT estado FROM cen_ordenes WHERE id = ${ordenId})
    UPDATE cen_ordenes o SET estado = 'enviado', updated_at = NOW()
    FROM previa
    WHERE o.id = ${ordenId} AND o.estado IN ('pendiente', 'error')
    RETURNING previa.estado AS estado_previo
  `
  if (!reserva) return { ok: false, mensaje: 'La orden ya se está enviando o ya tiene pedido en Siesa. Actualiza la lista.', prep }

  let r: Awaited<ReturnType<typeof enviarConector>>
  try {
    r = await enviarConector(ID_DOCUMENTO(), NOMBRE_DOCUMENTO(), prep.documento)
  } catch (e) {
    // Fallo de red: se libera la reserva. Si Siesa alcanzó a crear el pedido, el
    // siguiente intento lo detecta (prepararPedido busca la OC en Siesa y bloquea).
    await sql`UPDATE cen_ordenes SET estado = ${reserva.estado_previo}, updated_at = NOW() WHERE id = ${ordenId}`
    throw e
  }
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
