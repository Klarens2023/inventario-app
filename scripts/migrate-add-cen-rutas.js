#!/usr/bin/env node
/**
 * Rutas de despacho del módulo de órdenes EDI:
 *   - cen_puntos_ean gana ciudad y departamento (para decidir la ruta).
 *   - cen_reglas_ruta: reglas editables desde la app. Se evalúan por prioridad
 *     (menor primero) y gana la primera que cumpla: cadena (o todas), ciudad o
 *     departamento, y opcionalmente un rango de peso de la orden.
 *   - Carga las reglas iniciales identificadas en "BD 2026.xlsx" (sep-oct 2026).
 *     Las reglas de peso se agregan después desde la app.
 *
 * Correr UNA SOLA VEZ (las reglas iniciales solo se cargan si la tabla está vacía).
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-rutas.js
 */

const { neon } = require('@neondatabase/serverless')

const EXITO = '7701001000008', OLIMPICA = '7701008009080', MAKRO = '7706371000009', CENCOSUD = '7707185370005'

const COSTA = ['BARRANQUILLA', 'SOLEDAD', 'PUERTO COLOMBIA', 'MALAMBO', 'GALAPA', 'SABANALARGA', 'BARANOA', 'SANTO TOMAS',
  'SANTA MARTA', 'CIENAGA', 'CARTAGENA', 'TURBACO', 'ARJONA', 'MONTERIA']
const GUAJIRA_CIUDADES = ['RIOHACHA', 'MAICAO', 'FONSECA', 'SAN JUAN DEL CESAR', 'ALBANIA', 'BARRANCAS', 'HATONUEVO', 'DISTRACCION', 'URUMITA']
const SABANA = ['MONTERIA', 'SINCELEJO', 'LORICA', 'ARJONA', 'MAGANGUE', 'COROZAL', 'PLANETA RICA', 'CERETE', 'SAHAGUN', 'CHINU',
  'SAN MARCOS', 'MONTELIBANO', 'TIERRALTA', 'COVENAS', 'TOLU', 'CIENAGA DE ORO', 'SAN ONOFRE', 'SAMPUES']
const BOGOTA = ['BOGOTA', 'SOACHA', 'CHIA', 'CAJICA', 'FUNZA', 'MOSQUERA', 'COTA', 'ZIPAQUIRA', 'FUSAGASUGA', 'TOCANCIPA', 'MADRID', 'LA CALERA']
const INTERIOR = ['MEDELLIN', 'ENVIGADO', 'ITAGUI', 'BELLO', 'SABANETA', 'RIONEGRO', 'CALI', 'PALMIRA', 'VILLAVICENCIO', 'NEIVA',
  'IBAGUE', 'TUNJA', 'PEREIRA', 'MANIZALES', 'ARMENIA', 'YOPAL', 'DUITAMA', 'SOGAMOSO', 'PASTO', 'POPAYAN', 'GIRARDOT']

// [prioridad, ruta, comprador (null = todas), ciudades, departamentos, descripción]
const REGLAS = [
  // Éxito: según la ciudad del CEDI de entrega
  [10, 'EXEN', EXITO, ['ENVIGADO', 'MEDELLIN', 'ITAGUI', 'BELLO', 'SABANETA'], [], 'Éxito CEDI Envigado/Medellín'],
  [11, 'EXBOG', EXITO, BOGOTA, [], 'Éxito CEDI Bogotá'],
  [12, 'EXCAR', EXITO, ['BARRANQUILLA', 'MALAMBO', 'SOLEDAD', 'CARTAGENA'], [], 'Éxito CEDI Caribe'],
  [13, 'EXVAL', EXITO, ['VALLEDUPAR'], [], 'Éxito Valledupar'],
  [14, 'EXBU', EXITO, ['BUCARAMANGA', 'FLORIDABLANCA', 'GIRON', 'CUCUTA'], [], 'Éxito CEDI Bucaramanga/Cúcuta'],
  [15, 'EXCAL', EXITO, ['CALI', 'PALMIRA', 'YUMBO'], [], 'Éxito CEDI Cali'],
  [16, 'EXPER', EXITO, ['PEREIRA', 'DOSQUEBRADAS', 'MANIZALES'], [], 'Éxito CEDI Eje Cafetero'],
  // Cencosud: costa y región por operador regional; el resto del país va por la plataforma Ransa
  [20, 'SUPERVAL', CENCOSUD, ['VALLEDUPAR'], [], 'Cencosud Valledupar'],
  [21, 'GUAJIRA', CENCOSUD, GUAJIRA_CIUDADES, ['LA GUAJIRA'], 'Cencosud Guajira'],
  [22, 'DISTRYCAR', CENCOSUD, COSTA, [], 'Cencosud costa'],
  [29, 'CENPLA', CENCOSUD, [], [], 'Cencosud resto del país (plataforma Ransa)'],
  // Olímpica
  [30, 'OLMP-BOG', OLIMPICA, BOGOTA, [], 'Olímpica Bogotá y Sabana'],
  [31, 'SABANA', OLIMPICA, SABANA, ['CORDOBA', 'SUCRE'], 'Olímpica Córdoba/Sucre'],
  // Makro
  [40, 'KLARENSBOG', MAKRO, BOGOTA, [], 'Makro Bogotá'],
  [41, 'EXBU', MAKRO, ['BUCARAMANGA', 'FLORIDABLANCA', 'CUCUTA'], [], 'Makro Bucaramanga/Cúcuta'],
  // Generales (cualquier cadena)
  [90, 'SUPERVAL', null, ['VALLEDUPAR'], [], 'Valledupar'],
  [91, 'GUAJIRA', null, GUAJIRA_CIUDADES, ['LA GUAJIRA'], 'Guajira'],
  [92, 'DISTRYCAR', null, COSTA, ['ATLANTICO', 'MAGDALENA'], 'Costa'],
  [93, 'SABANA', null, SABANA, ['CORDOBA', 'SUCRE'], 'Córdoba/Sucre'],
  [94, 'KLARENSBOG', null, BOGOTA, [], 'Bogotá y Sabana'],
  [95, 'PYM', null, INTERIOR, [], 'Interior intermedio'],
]

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(DATABASE_URL)

  await sql`ALTER TABLE cen_puntos_ean ADD COLUMN IF NOT EXISTS ciudad VARCHAR(60)`
  await sql`ALTER TABLE cen_puntos_ean ADD COLUMN IF NOT EXISTS departamento VARCHAR(60)`

  await sql`
    CREATE TABLE IF NOT EXISTS cen_reglas_ruta (
      id             SERIAL PRIMARY KEY,
      prioridad      INTEGER     NOT NULL DEFAULT 100,
      ruta           VARCHAR(40) NOT NULL,
      ean_comprador  VARCHAR(20),
      ciudades       TEXT[]      NOT NULL DEFAULT '{}',
      departamentos  TEXT[]      NOT NULL DEFAULT '{}',
      peso_min       NUMERIC(12,3),
      peso_max       NUMERIC(12,3),
      descripcion    VARCHAR(120),
      activo         BOOLEAN     NOT NULL DEFAULT TRUE,
      updated_at     TIMESTAMP   NOT NULL DEFAULT NOW()
    )
  `

  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM cen_reglas_ruta`
  if (n === 0) {
    for (const [prioridad, ruta, comprador, ciudades, deptos, desc] of REGLAS) {
      await sql`
        INSERT INTO cen_reglas_ruta (prioridad, ruta, ean_comprador, ciudades, departamentos, descripcion)
        VALUES (${prioridad}, ${ruta}, ${comprador}, ${ciudades}, ${deptos}, ${desc})
      `
    }
    console.log(`✅ ${REGLAS.length} reglas de ruta iniciales cargadas`)
  } else {
    console.log(`ℹ cen_reglas_ruta ya tenía ${n} reglas: no se cargaron las iniciales`)
  }
  console.log('✅ Columnas ciudad/departamento y tabla cen_reglas_ruta listas')
}

main().catch(e => { console.error(e); process.exit(1) })
