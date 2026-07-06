#!/usr/bin/env node
/**
 * Crea las tablas tic_movimientos y tic_movimiento_activos.
 * Correr UNA SOLA VEZ.
 * Uso PowerShell: $env:DATABASE_URL="..."; node scripts/migrate-add-tic-movimientos.js
 */
const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS tic_movimientos (
      id                VARCHAR(12)  PRIMARY KEY,
      fecha             DATE         NOT NULL,
      movimiento        VARCHAR(20)  NOT NULL CHECK (movimiento IN ('definitivo','temporal')),
      tipo_movimiento   VARCHAR(60)  NOT NULL,
      motivo            VARCHAR(80)  NOT NULL,
      origen_nombre     VARCHAR(120) NOT NULL,
      origen_documento  VARCHAR(30)  NOT NULL,
      origen_area       VARCHAR(60)  NOT NULL,
      destino_nombre    VARCHAR(120) NOT NULL,
      destino_documento VARCHAR(30)  NOT NULL,
      destino_area      VARCHAR(60)  NOT NULL,
      observaciones     TEXT,
      estado            VARCHAR(20)  NOT NULL DEFAULT 'autorizado'
                          CHECK (estado IN ('autorizado','entregado','recibido','cerrado')),
      registrado_por    VARCHAR(120) NOT NULL,
      created_at        TIMESTAMP    DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS tic_movimiento_activos (
      id              SERIAL       PRIMARY KEY,
      movimiento_id   VARCHAR(12)  NOT NULL REFERENCES tic_movimientos(id) ON DELETE CASCADE,
      equipo_id       VARCHAR(20)  NOT NULL,
      descripcion     VARCHAR(200) NOT NULL,
      tipo_activo     VARCHAR(60)  NOT NULL,
      cantidad        INTEGER      NOT NULL DEFAULT 1 CHECK (cantidad > 0)
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_tic_mov_fecha   ON tic_movimientos(fecha)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_mov_estado  ON tic_movimientos(estado)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_act_mov_id  ON tic_movimiento_activos(movimiento_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_act_eq_id   ON tic_movimiento_activos(equipo_id)`

  console.log('✅ Tablas tic_movimientos y tic_movimiento_activos creadas correctamente')
}

main().catch(e => { console.error(e); process.exit(1) })
