#!/usr/bin/env node
/**
 * Tablas para escoger la sucursal de Siesa de un punto de entrega desde un listado:
 *   - cen_sucursales_siesa: dirección y ciudad de cada sucursal (NIT + sucursal), cargadas desde
 *     la base de clientes de Siesa (scripts/import-cen-sucursales-siesa.js). Qué sucursales existen
 *     y si están activas se consulta en vivo en Siesa; de aquí solo salen dirección y ciudad.
 *   - cen_solicitudes_sucursal: avisos de "la sucursal no está creada en Siesa" por punto de
 *     entrega (EAN), para que se vea que ya se pidió y no se pida dos veces.
 * Sin estas tablas la app sigue funcionando: el listado sale sin dirección y sin solicitudes.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-sucursales-siesa.js
 */
const { neon } = require('@neondatabase/serverless')
async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  await sql`
    CREATE TABLE IF NOT EXISTS cen_sucursales_siesa (
      nit           VARCHAR(15)  NOT NULL,
      sucursal      VARCHAR(3)   NOT NULL,
      razon_social  VARCHAR(120),
      direccion     VARCHAR(200),
      ciudad        VARCHAR(80),
      departamento  VARCHAR(80),
      actualizado_at TIMESTAMP   NOT NULL DEFAULT NOW(),
      PRIMARY KEY (nit, sucursal)
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS cen_solicitudes_sucursal (
      id            SERIAL PRIMARY KEY,
      ean_entrega   VARCHAR(14)  NOT NULL,
      nit           VARCHAR(15),
      numero_orden  VARCHAR(40),
      usuario_id    INTEGER,
      usuario       VARCHAR(120),
      created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
    )`
  await sql`CREATE INDEX IF NOT EXISTS cen_solicitudes_sucursal_ean ON cen_solicitudes_sucursal (ean_entrega, created_at DESC)`
  console.log('✅ cen_sucursales_siesa y cen_solicitudes_sucursal listas')
}
main().catch(e => { console.error(e); process.exit(1) })
