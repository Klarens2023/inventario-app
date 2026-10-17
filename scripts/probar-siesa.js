#!/usr/bin/env node
/**
 * Prueba de SOLO LECTURA de las consultas de la API Connekta que usa el módulo
 * de órdenes EDI: cliente/sucursal, pedidos por documento de referencia y
 * precios por lista. No crea ni modifica nada en Siesa.
 *
 * Variables (en .env.local): SIESA_CLIENT_ID, SIESA_CONNI_KEY, SIESA_CONNI_TOKEN
 *   (opcionales: SIESA_API_URL, SIESA_ID_COMPANIA)
 * Uso: node --env-file=.env.local scripts/probar-siesa.js [nit] [sucursal] [oc]
 *      node --env-file=.env.local scripts/probar-siesa.js 890107487 182 4646646770
 */

const BASE = (process.env.SIESA_API_URL || 'https://apiqa.siesacloud.com/connekta/siesa/estandar').replace(/\/$/, '')
const COMPANIA = process.env.SIESA_ID_COMPANIA || '9116'
const [nit = '890107487', sucursal = '182', oc = '4646646770'] = process.argv.slice(2)

const cond = (campo, valor) => `${campo}=''${valor}''`

async function consultar(descripcion, parametros, tamano = 100) {
  let url = `${BASE}/consulta/v3?idCompania=${COMPANIA}&descripcion=${encodeURIComponent(descripcion)}&paginacion=numPag=1|tamPag=${tamano}`
  if (parametros) url += `&parametros=${encodeURIComponent(parametros)}`
  const res = await fetch(url, {
    headers: { client_id: process.env.SIESA_CLIENT_ID, ConniKey: process.env.SIESA_CONNI_KEY, ConniToken: process.env.SIESA_CONNI_TOKEN },
  })
  const texto = await res.text()
  let data; try { data = JSON.parse(texto) } catch { data = texto }
  return { status: res.status, data }
}

function mostrar(titulo, r, campos) {
  const filas = r.data?.detalle?.Table
  console.log(`\n── ${titulo} → HTTP ${r.status} · codigo ${r.data?.codigo} · ${r.data?.mensaje ?? ''}`)
  if (!Array.isArray(filas)) { console.log(typeof r.data === 'string' ? r.data.slice(0, 400) : JSON.stringify(r.data).slice(0, 400)); return }
  console.log(`   ${filas.length} fila(s)`)
  for (const f of filas.slice(0, 5)) console.log('   ', Object.fromEntries(campos.map(c => [c, f[c]])))
}

async function main() {
  for (const v of ['SIESA_CLIENT_ID', 'SIESA_CONNI_KEY', 'SIESA_CONNI_TOKEN']) {
    if (!process.env[v]) { console.error(`❌ Falta ${v} en .env.local`); process.exit(1) }
  }

  const cli = await consultar('API_v2_Clientes', `${cond('f200_nit', nit)} AND ${cond('f201_id_sucursal', sucursal)}`)
  mostrar(`Cliente ${nit}/${sucursal}`, cli, ['f201_descripcion_sucursal', 'f201_ind_estado_bloqueado', 'f201_ind_estado_activo', 'f201_id_lista_precio', 'f201_id_cond_pago', 'f201_id_tipo_cli'])
  const lista = cli.data?.detalle?.Table?.[0]?.f201_id_lista_precio?.trim()

  mostrar(`Pedidos con OC ${oc} (filtro por documento de referencia)`,
    await consultar('API_v2_Ventas_Pedidos', `${cond('f430_num_docto_referencia', oc)} AND ${cond('f200_nit_pedido_fact', nit)}`),
    ['f430_id_tipo_docto', 'f430_consec_docto', 'f430_ind_estado', 'f430_num_docto_referencia'])

  if (lista) {
    mostrar(`Precios de la lista ${lista} (filtro por lista)`,
      await consultar('API_v2_ItemsPrecios', cond('f126_id_lista_precio', lista), 20),
      ['f120_id', 'f120_referencia', 'f120_descripcion', 'f126_id_lista_precio', 'f126_precio', 'f126_fecha_activacion'])
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
