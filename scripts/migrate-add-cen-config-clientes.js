#!/usr/bin/env node
/**
 * Configuración por cliente (NIT) para armar el pedido de venta en Siesa desde
 * una orden EDI. La lista de precios, la condición de pago y el tipo de cliente
 * se toman del maestro de clientes de Siesa (API_v2_Clientes); aquí van la
 * bodega, el centro de operación, el tipo de documento, el indicador de precio
 * y, si hace falta, una lista de precios o condición de pago que reemplace la
 * del maestro.
 *
 * Carga una fila por cada cadena EDI conocida con los valores del pedido de
 * ejemplo (bodega 00110, CO 001, PVK, precio de la orden).
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-config-clientes.js
 */

const { neon } = require('@neondatabase/serverless')

const CADENAS = [
  ['890900608', 'Almacenes Éxito'],
  ['890107487', 'Olímpica'],
  ['900059238', 'Makro'],
  ['900155107', 'Cencosud'],
  ['900276962', 'D1'],
  ['900480569', 'Jerónimo Martins (Ara)'],
]

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS cen_config_clientes (
      nit            VARCHAR(15) PRIMARY KEY,
      nombre         VARCHAR(80),
      id_co          VARCHAR(3)  NOT NULL DEFAULT '001',
      tipo_docto     VARCHAR(3)  NOT NULL DEFAULT 'PVK',
      bodega         VARCHAR(5)  NOT NULL DEFAULT '00110',
      ind_precio     VARCHAR(1)  NOT NULL DEFAULT '2' CHECK (ind_precio IN ('0','1','2')),
      lista_precio   VARCHAR(3),
      cond_pago      VARCHAR(3),
      updated_at     TIMESTAMP   NOT NULL DEFAULT NOW()
    )
  `
  for (const [nit, nombre] of CADENAS) {
    await sql`INSERT INTO cen_config_clientes (nit, nombre) VALUES (${nit}, ${nombre}) ON CONFLICT (nit) DO NOTHING`
  }
  console.log('✅ Tabla cen_config_clientes lista')
}

main().catch(e => { console.error(e); process.exit(1) })
