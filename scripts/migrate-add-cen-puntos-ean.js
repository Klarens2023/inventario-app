#!/usr/bin/env node
/**
 * Tabla maestra para el módulo de órdenes CEN (Logística): relaciona el EAN de
 * cada punto de venta que llega en las órdenes de compra de CEN con el cliente
 * (NIT) y la sucursal de Siesa a la que se le debe crear el pedido.
 *
 * Un EAN pertenece a una sola sucursal (Siesa no permite repetirlo entre
 * puntos de envío), por eso es UNIQUE.
 *
 * Correr UNA SOLA VEZ.
 * Uso: DATABASE_URL="..." node scripts/migrate-add-cen-puntos-ean.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS cen_puntos_ean (
      id            SERIAL PRIMARY KEY,
      nit           VARCHAR(15)  NOT NULL,
      sucursal      VARCHAR(3)   NOT NULL,
      razon_social  VARCHAR(100) NOT NULL,
      ean           VARCHAR(35)  NOT NULL UNIQUE,
      activo        BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
      UNIQUE (nit, sucursal)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_puntos_ean_nit ON cen_puntos_ean(nit)`

  console.log('✅ Tabla cen_puntos_ean creada')
}

main().catch(e => { console.error(e); process.exit(1) })
