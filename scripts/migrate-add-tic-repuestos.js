#!/usr/bin/env node
/**
 * Crea las tablas tic_articulos (repuestos, insumos y periféricos con su stock)
 * y tic_articulo_movimientos (kardex de entradas, salidas y ajustes) y
 * tic_articulo_asignaciones (qué tiene asignado cada equipo/persona, préstamos,
 * reemplazos y retiros, con historial completo).
 * Se puede volver a correr sin riesgo: todo usa IF NOT EXISTS.
 * Uso PowerShell: $env:DATABASE_URL="..."; node scripts/migrate-add-tic-repuestos.js
 */
const { neon } = require('@neondatabase/serverless')

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS tic_articulos (
      codigo          VARCHAR(12)   PRIMARY KEY,
      categoria       VARCHAR(20)   NOT NULL CHECK (categoria IN ('Repuesto','Insumo','Periférico')),
      tipo            VARCHAR(60)   NOT NULL,
      descripcion     VARCHAR(200)  NOT NULL,
      marca           VARCHAR(60),
      referencia      VARCHAR(80),
      compatible_con  VARCHAR(200),
      unidad          VARCHAR(20)   NOT NULL DEFAULT 'Unidad',
      stock_actual    INTEGER       NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
      stock_minimo    INTEGER       NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
      ubicacion       VARCHAR(80),
      costo_unitario  NUMERIC(14,2),
      activo          BOOLEAN       NOT NULL DEFAULT TRUE,
      observaciones   TEXT,
      registrado_por  VARCHAR(120)  NOT NULL,
      created_at      TIMESTAMP     DEFAULT NOW(),
      actualizado_en  TIMESTAMP     DEFAULT NOW()
    )
  `

  // cantidad = variación con signo (+ entrada, − salida, ± ajuste por conteo)
  await sql`
    CREATE TABLE IF NOT EXISTS tic_articulo_movimientos (
      id                SERIAL        PRIMARY KEY,
      articulo_codigo   VARCHAR(12)   NOT NULL REFERENCES tic_articulos(codigo),
      fecha             DATE          NOT NULL,
      tipo              VARCHAR(10)   NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
      motivo            VARCHAR(80)   NOT NULL,
      cantidad          INTEGER       NOT NULL,
      stock_anterior    INTEGER       NOT NULL,
      stock_resultante  INTEGER       NOT NULL,
      equipo_id         VARCHAR(20),
      destino_nombre    VARCHAR(120),
      destino_area      VARCHAR(60),
      proveedor         VARCHAR(120),
      documento_ref     VARCHAR(60),
      costo_unitario    NUMERIC(14,2),
      contador_paginas  INTEGER,
      observaciones     TEXT,
      registrado_por    VARCHAR(120)  NOT NULL,
      created_at        TIMESTAMP     DEFAULT NOW()
    )
  `
  // costo_unitario: costo vigente al momento del movimiento (base del análisis de gasto)
  // contador_paginas: lectura del contador de la impresora al cambiar tóner/tinta (rendimiento real)
  await sql`ALTER TABLE tic_articulo_movimientos ADD COLUMN IF NOT EXISTS contador_paginas INTEGER`

  // Una fila por entrega a equipo o persona. Nunca se borra: al retirarla se cierra
  // indicando qué pasó con el artículo (destino_retiro) y, si fue reemplazo, por cuál.
  await sql`
    CREATE TABLE IF NOT EXISTS tic_articulo_asignaciones (
      id                     SERIAL        PRIMARY KEY,
      articulo_codigo        VARCHAR(12)   NOT NULL REFERENCES tic_articulos(codigo),
      cantidad               INTEGER       NOT NULL CHECK (cantidad > 0),
      equipo_id              VARCHAR(20),
      persona_nombre         VARCHAR(120),
      persona_area           VARCHAR(60),
      es_prestamo            BOOLEAN       NOT NULL DEFAULT FALSE,
      fecha_asignacion       DATE          NOT NULL,
      fecha_limite_prestamo  DATE,
      observaciones          TEXT,
      estado                 VARCHAR(12)   NOT NULL DEFAULT 'vigente'
                               CHECK (estado IN ('vigente','devuelto','reemplazado')),
      destino_retiro         VARCHAR(12)   CHECK (destino_retiro IN ('inventario','baja','garantia','perdido')),
      fecha_retiro           DATE,
      motivo_retiro          VARCHAR(80),
      detalle_retiro         TEXT,
      reemplaza_a            INTEGER       REFERENCES tic_articulo_asignaciones(id),
      reemplazada_por        INTEGER       REFERENCES tic_articulo_asignaciones(id),
      movimiento_salida_id   INTEGER       NOT NULL REFERENCES tic_articulo_movimientos(id),
      movimiento_retorno_id  INTEGER       REFERENCES tic_articulo_movimientos(id),
      registrado_por         VARCHAR(120)  NOT NULL,
      cerrado_por            VARCHAR(120),
      created_at             TIMESTAMP     DEFAULT NOW(),
      cerrado_en             TIMESTAMP,
      CHECK (equipo_id IS NOT NULL OR persona_nombre IS NOT NULL),
      CHECK (NOT es_prestamo OR fecha_limite_prestamo IS NOT NULL)
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_tic_art_categoria ON tic_articulos(categoria)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_artmov_art    ON tic_articulo_movimientos(articulo_codigo)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_artmov_fecha  ON tic_articulo_movimientos(fecha)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_artmov_equipo ON tic_articulo_movimientos(equipo_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_asig_equipo   ON tic_articulo_asignaciones(equipo_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_asig_estado   ON tic_articulo_asignaciones(estado)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tic_asig_articulo ON tic_articulo_asignaciones(articulo_codigo)`

  console.log('✅ Tablas tic_articulos, tic_articulo_movimientos y tic_articulo_asignaciones listas')
  console.log('ℹ️  Asigna el módulo "Repuestos e Insumos" a los usuarios desde /admin/usuarios (el admin ya lo ve).')
}

main().catch(e => { console.error(e); process.exit(1) })
