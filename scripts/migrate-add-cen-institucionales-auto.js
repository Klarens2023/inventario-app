#!/usr/bin/env node
/**
 * Pedidos institucionales automáticos (lib/cen/pedidosInstitucionales.ts → traerInstitucionalesAutomaticos):
 *   - cen_clientes_institucionales: clientes cuyos pedidos PVK se traen solos a una ruta, con las
 *     ciudades (códigos DANE "DD-CCC" del punto de envío) que aplican. Se carga con el
 *     "LISTADO DE CLIENTES INSTITUCIONALES COSTA" (13/11/2026), todos a la ruta DISTRYCAR.
 *   - cen_institucional_ignorados: pedidos que alguien quitó de la ruta, para no volver a traerlos.
 * Sin estas tablas la app sigue igual; solo no trae institucionales automáticamente.
 * Uso: node --env-file=.env.local scripts/migrate-add-cen-institucionales-auto.js
 */
const { neon } = require('@neondatabase/serverless')

const BAQ = '08-001', CTG = '13-001', SMR = '47-001', ALBANIA = '44-035', EL_PASO = '20-250'
const CLIENTES = [
  ['900040299', 'ATLANTIC FS SAS', [BAQ, CTG]],
  ['800000276', 'AVICOLA DE MADRONO SA', [CTG]],
  ['7443207', 'BERRIO BATISTA CARLOS ARTURO', [BAQ]],
  ['1070807600', 'BURGOS RAMOS ADERSON MANUEL', [CTG]],
  ['819000986', 'C B HOTELES Y RESORT S A', [SMR]],
  ['891700341', 'CORPORACION CLUB SANTA MARTA', [SMR]],
  ['806003168', 'CORPORACION GESTION Y ACCION POR COLOMBIA', [SMR]],
  ['802006391', 'CREPES CARIBE S A', [BAQ]],
  ['806014415', 'CREPES CARTAGENA S A', [CTG]],
  ['52589831', 'CUELLAR GUERRERO MARIANA', [SMR]],
  ['901644957', 'DISTRIBUCIONES GENESIS DE LA COSTA SAS', [SMR]],
  ['900119726', 'EVENTOS Y DESARROLLO SAS', [CTG]],
  ['802007962', 'FUNDACION CENTRO DE DESARROLLO SOCIAL CE', [BAQ, SMR]],
  ['901602364', 'HOTELES DE GETSE SOCIEDAD POR ACCIONES SIMPLIFICADA', [CTG]],
  ['901948361', 'INVERSIONES GASTROGER SAS', [BAQ]],
  ['811006789', 'JUAN D HOYOS DISTRIBUCIONES S A S', [CTG]],
  ['901406577', 'LETS DOUGH IT SAS', [BAQ]],
  ['22620564', 'MARENCO BARANDICA NINOSKA', [BAQ]],
  ['901976558', 'MURCA SAS', [SMR]],
  ['890929877', 'NEWREST SERVICES COLOMBIA SAS', [ALBANIA, EL_PASO, SMR]],
  ['900673132', 'NICOSU SAS', [BAQ, SMR]],
  ['830097922', 'OPERADORES HOTELEROS REGENCY S A', [SMR]],
  ['72178323', 'ORFALE BORICON ABDALA JABID', [BAQ]],
  ['901329054', 'PREMIUM FOOD COMPANY SAS', [BAQ]],
  ['900201474', 'PRODUCTORA Y COMERCIALIZADORA QUIMICA PROCOQUIM S.A.S', [BAQ]],
  ['901821408', 'SANTIS OPERADORA INMOBILIARIA CASABLANCA', [SMR]],
  ['800079603', 'SERVICIOS DE ALIMENTACION NP SA', [BAQ]],
  ['900464271', 'SUBS CORP S A S', [BAQ]],
  ['891701294', 'TENERIFE S A', [SMR]],
  ['55302274', 'VELILLA GARCIA CHARLENE DEL ROSARIO', [BAQ]],
  ['902115646', 'HUNIA GROUP S.A.S', [BAQ]],
]

async function main() {
  if (!process.env.DATABASE_URL) { console.error('❌ Falta DATABASE_URL'); process.exit(1) }
  const sql = neon(process.env.DATABASE_URL)
  console.log('Base:', process.env.DATABASE_URL.match(/@([^.]+)/)[1])
  await sql`
    CREATE TABLE IF NOT EXISTS cen_clientes_institucionales (
      nit VARCHAR(15) PRIMARY KEY,
      nombre VARCHAR(160) NOT NULL,
      ciudades TEXT[] NOT NULL DEFAULT '{}',
      ruta VARCHAR(40) NOT NULL DEFAULT 'DISTRYCAR',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_por VARCHAR(120)
    )`
  await sql`
    CREATE TABLE IF NOT EXISTS cen_institucional_ignorados (
      pedido VARCHAR(30) PRIMARY KEY,
      quitado_por VARCHAR(120),
      quitado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  let nuevos = 0
  for (const [nit, nombre, ciudades] of CLIENTES) {
    const r = await sql`
      INSERT INTO cen_clientes_institucionales (nit, nombre, ciudades, ruta, updated_por)
      VALUES (${nit}, ${nombre}, ${ciudades}::text[], 'DISTRYCAR', 'Listado institucionales Costa')
      ON CONFLICT (nit) DO NOTHING RETURNING nit`
    nuevos += r.length
  }
  console.log(`✅ Tablas listas · ${nuevos} cliente(s) institucional(es) cargados (${CLIENTES.length - nuevos} ya estaban)`)
}
main().catch(e => { console.error(e); process.exit(1) })
