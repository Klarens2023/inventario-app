#!/usr/bin/env node
/**
 * Tablas del módulo de órdenes de compra EDI (Logística): archivos leídos de
 * los SFTP de Carvajal (CEN) y Subrik, las órdenes con sus líneas, y el
 * maestro de productos (EAN del ítem → código Siesa, peso y unidades por caja)
 * para calcular el peso de cada orden.
 *
 * Los archivos NUNCA se borran ni se mueven del SFTP: cen_archivos guarda cuáles
 * ya se procesaron para no volver a leerlos.
 *
 * Requiere cen_puntos_ean (scripts/migrate-add-cen-puntos-ean.js).
 * Correr UNA SOLA VEZ.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-ordenes.js
 */

const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }

  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS cen_productos (
      ean            VARCHAR(20)  PRIMARY KEY,
      item           VARCHAR(20),
      descripcion    VARCHAR(200),
      peso_kg        NUMERIC(10,4) NOT NULL DEFAULT 0,
      und_caja       INTEGER,
      peso_embalaje  NUMERIC(10,4),
      updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS cen_archivos (
      id             SERIAL PRIMARY KEY,
      fuente         VARCHAR(20)  NOT NULL,
      nombre         VARCHAR(255) NOT NULL,
      tamano         INTEGER,
      fecha_archivo  TIMESTAMP,
      estado         VARCHAR(20)  NOT NULL DEFAULT 'ok' CHECK (estado IN ('ok','error')),
      error          TEXT,
      contenido      TEXT,
      procesado_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
      UNIQUE (fuente, nombre)
    )
  `

  // estado: pendiente (lista para pedido) · sin_punto (EAN de entrega sin homologar)
  //         enviado (pedido creado en Siesa) · error (Siesa la rechazó) · descartada
  await sql`
    CREATE TABLE IF NOT EXISTS cen_ordenes (
      id                 SERIAL PRIMARY KEY,
      fuente             VARCHAR(20)  NOT NULL,
      archivo_id         INTEGER REFERENCES cen_archivos(id),
      numero_orden       VARCHAR(35)  NOT NULL,
      fecha_orden        DATE,
      fecha_entrega      DATE,
      fecha_entrega_max  DATE,
      ean_comprador      VARCHAR(20)  NOT NULL,
      ean_entrega        VARCHAR(20)  NOT NULL,
      nit                VARCHAR(15),
      sucursal           VARCHAR(3),
      razon_social       VARCHAR(100),
      total_unidades     NUMERIC(14,2) NOT NULL DEFAULT 0,
      valor_total        NUMERIC(16,2) NOT NULL DEFAULT 0,
      peso_kg            NUMERIC(12,3),
      ruta               VARCHAR(40),
      ruta_manual        BOOLEAN NOT NULL DEFAULT FALSE,
      estado             VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                           CHECK (estado IN ('pendiente','sin_punto','enviado','error','descartada')),
      siesa_consecutivo  VARCHAR(20),
      siesa_respuesta    JSONB,
      enviado_at         TIMESTAMP,
      created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (ean_comprador, numero_orden)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_ordenes_estado ON cen_ordenes(estado)`
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_ordenes_entrega ON cen_ordenes(fecha_entrega)`
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_ordenes_ean_entrega ON cen_ordenes(ean_entrega)`

  await sql`
    CREATE TABLE IF NOT EXISTS cen_orden_lineas (
      id              SERIAL PRIMARY KEY,
      orden_id        INTEGER NOT NULL REFERENCES cen_ordenes(id) ON DELETE CASCADE,
      nro_linea       INTEGER NOT NULL,
      ean_item        VARCHAR(20) NOT NULL,
      cod_comprador   VARCHAR(35),
      descripcion     VARCHAR(200),
      cantidad        NUMERIC(14,3) NOT NULL,
      precio          NUMERIC(16,4) NOT NULL DEFAULT 0,
      iva             NUMERIC(6,2)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_lineas_orden ON cen_orden_lineas(orden_id)`

  // Reparto por tienda de cada línea cuando la orden se entrega en un CEDI
  // (Éxito): segmentos LOC+7 (EAN del local) + QTY+11 (cantidad para ese local).
  await sql`
    CREATE TABLE IF NOT EXISTS cen_orden_distribucion (
      id         SERIAL PRIMARY KEY,
      linea_id   INTEGER NOT NULL REFERENCES cen_orden_lineas(id) ON DELETE CASCADE,
      ean_local  VARCHAR(20) NOT NULL,
      cantidad   NUMERIC(14,3) NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cen_distribucion_linea ON cen_orden_distribucion(linea_id)`

  console.log('✅ Tablas cen_productos, cen_archivos, cen_ordenes, cen_orden_lineas y cen_orden_distribucion creadas')
}

main().catch(e => { console.error(e); process.exit(1) })
