import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verificarAcceso } from '@/lib/cen/acceso'
import { nombreComprador } from '@/lib/cen/compradores'
import { consultarTodo, condicion, siesaConfigurado } from '@/lib/siesa/connekta'
import { combinarSucursales, correoSucursalNoCreada, listaCorreos } from '@/lib/cen/sucursalesPunto'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

// Las tablas de direcciones y solicitudes las crea scripts/migrate-add-cen-sucursales-siesa.js;
// sin ellas el listado sale sin dirección y sin solicitudes previas (no falla).
const sinTabla = (e: unknown) => /does not exist/i.test(String((e as Error)?.message ?? e))

// GET /api/logistica/ordenes-cen/puntos/sucursales?ean=7701001000800[&nit=890900608]
// Para el formulario "Asignar sucursal": NIT sugerido (el de la cadena que hace la orden),
// sucursales de ese NIT en Siesa con su dirección y ciudad, si el punto ya tiene un aviso de
// "sucursal no creada" y el correo listo para ese aviso.
export async function GET(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const ean = (req.nextUrl.searchParams.get('ean') ?? '').trim()
  if (!/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: 'EAN inválido' }, { status: 400 })

  // Orden más reciente de ese punto: de ahí salen la cadena y el número de OC para el correo
  const [orden] = await sql`
    SELECT ean_comprador, numero_orden FROM cen_ordenes WHERE ean_entrega = ${ean} ORDER BY created_at DESC LIMIT 1`
  // Cada cadena se ha facturado siempre a un mismo NIT: se sugiere el más usado en sus órdenes
  let nit = (req.nextUrl.searchParams.get('nit') ?? '').replace(/\D/g, '').slice(0, 15)
  if (!nit && orden) {
    const [n] = await sql`
      SELECT nit FROM cen_ordenes WHERE ean_comprador = ${orden.ean_comprador} AND nit IS NOT NULL
      GROUP BY nit ORDER BY COUNT(*) DESC LIMIT 1`
    nit = n?.nit ?? ''
  }

  let sucursales: ReturnType<typeof combinarSucursales> = []
  let errorSiesa: string | null = null
  if (nit) {
    if (!siesaConfigurado()) errorSiesa = 'La API de Siesa no está configurada.'
    else {
      try {
        const [siesa, locales, eans] = await Promise.all([
          consultarTodo<Record<string, unknown>>('API_v2_Clientes', condicion('f200_nit', nit)),
          sql`SELECT sucursal, direccion, ciudad, departamento FROM cen_sucursales_siesa WHERE nit = ${nit}`
            .catch(e => { if (sinTabla(e)) return []; throw e }),
          sql`SELECT sucursal, array_agg(ean ORDER BY ean) AS eans FROM cen_puntos_ean WHERE nit = ${nit} AND activo GROUP BY sucursal`,
        ])
        sucursales = combinarSucursales(siesa, locales as never, new Map(eans.map(e => [e.sucursal as string, e.eans as string[]])))
      } catch (e) {
        errorSiesa = `No se pudieron consultar las sucursales en Siesa: ${e instanceof Error ? e.message : e}`
      }
    }
  }

  const [solicitud] = await sql`
    SELECT usuario, created_at FROM cen_solicitudes_sucursal WHERE ean_entrega = ${ean} ORDER BY created_at DESC LIMIT 1`
    .catch(e => { if (sinTabla(e)) return []; throw e })

  const cadena = orden ? nombreComprador(orden.ean_comprador) : 'Cliente'
  return NextResponse.json({
    ean, nit, cadena, numeroOrden: orden?.numero_orden ?? null,
    sucursales, errorSiesa,
    solicitud: solicitud ?? null,
    correo: {
      // Destinatarios fijos (Vercel): el usuario no los escribe, así la app no sirve para escribirle a cualquiera
      para: listaCorreos(process.env.CORREO_SUCURSALES_PARA),
      cc: listaCorreos(process.env.CORREO_SUCURSALES_CC),
      ...correoSucursalNoCreada({ cadena, nit: nit || null, eanEntrega: ean, numeroOrden: orden?.numero_orden ?? null }),
    },
  })
}

// POST /api/logistica/ordenes-cen/puntos/sucursales — deja constancia de que se pidió crear la
// sucursal de un punto (el correo lo envía la persona desde su Gmail). Body: { ean, nit? }
export async function POST(req: NextRequest) {
  const acceso = await verificarAcceso(req)
  if ('respuesta' in acceso) return acceso.respuesta
  const { user } = acceso
  const b = await req.json().catch(() => ({})) as { ean?: string; nit?: string }
  const ean = String(b.ean ?? '').trim()
  if (!/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: 'EAN inválido' }, { status: 400 })
  const nit = String(b.nit ?? '').replace(/\D/g, '').slice(0, 15) || null
  const [orden] = await sql`SELECT numero_orden FROM cen_ordenes WHERE ean_entrega = ${ean} ORDER BY created_at DESC LIMIT 1`
  try {
    await sql`
      INSERT INTO cen_solicitudes_sucursal (ean_entrega, nit, numero_orden, usuario_id, usuario)
      VALUES (${ean}, ${nit}, ${orden?.numero_orden ?? null}, ${Number(user.id) || null}, ${user.name})`
  } catch (e) {
    if (!sinTabla(e)) throw e
    return NextResponse.json({ error: 'Falta crear la tabla de solicitudes (scripts/migrate-add-cen-sucursales-siesa.js)' }, { status: 503 })
  }
  await logAudit({
    usuarioId: user.id, usuarioNombre: user.name, accion: 'SUCURSAL_SOLICITADA',
    descripcion: `Pidió crear en Siesa la sucursal del punto de entrega EAN ${ean}${nit ? ` (NIT ${nit})` : ''}`,
    datos: { ean, nit, numero_orden: orden?.numero_orden ?? null },
  })
  return NextResponse.json({ ok: true })
}
