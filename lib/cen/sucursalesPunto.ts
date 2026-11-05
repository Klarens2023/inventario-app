// Listado de sucursales de Siesa para asociar un punto de entrega (EAN) y el aviso por
// correo cuando la sucursal no está creada. Sin dependencias de servidor: lo usan
// app/api/logistica/ordenes-cen/puntos/sucursales/route.ts y las pruebas.

export interface SucursalListado {
  sucursal: string
  razon_social: string
  activa: boolean
  direccion: string | null
  ciudad: string | null
  departamento: string | null
  sinDireccion: boolean   // está en Siesa pero no en la base de direcciones importada
  eans: string[]          // puntos de entrega (EAN) que ya están asociados a esta sucursal
}

/**
 * Junta las sucursales que trae Siesa en vivo (cuáles existen, nombre y si están activas)
 * con la dirección y la ciudad de la base importada (cen_sucursales_siesa). Manda Siesa:
 * una sucursal que no está en la base importada aparece igual, marcada "sin dirección".
 * Activas primero, luego por código de sucursal.
 */
export function combinarSucursales(
  siesa: Record<string, unknown>[],
  locales: { sucursal: string; direccion: string | null; ciudad: string | null; departamento: string | null }[],
  eansPorSucursal: Map<string, string[]>,
): SucursalListado[] {
  const porSucursal = new Map(locales.map(l => [l.sucursal, l]))
  const vistas = new Set<string>()
  const lista: SucursalListado[] = []
  for (const s of siesa) {
    const sucursal = String(s.f201_id_sucursal ?? '').trim()
    if (!sucursal || vistas.has(sucursal)) continue
    vistas.add(sucursal)
    const local = porSucursal.get(sucursal)
    lista.push({
      sucursal,
      razon_social: String(s.f201_descripcion_sucursal ?? '').replace(/\s+/g, ' ').trim(),
      activa: Number(s.f201_ind_estado_activo) !== 0,
      direccion: local?.direccion ?? null,
      ciudad: local?.ciudad ?? null,
      departamento: local?.departamento ?? null,
      sinDireccion: !local?.direccion,
      eans: eansPorSucursal.get(sucursal) ?? [],
    })
  }
  return lista.sort((a, b) => Number(b.activa) - Number(a.activa) || a.sucursal.localeCompare(b.sucursal))
}

/** "a@x.com, b@x.com; c@x.com" → correos válidos, sin repetir. */
export function listaCorreos(valor: string | undefined | null): string[] {
  return Array.from(new Set(String(valor ?? '').split(/[,;\s]+/).map(c => c.trim().toLowerCase())
    .filter(c => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))))
}

/**
 * Correo para pedir que se cree la sucursal en Siesa. Solo datos del cliente: lo demás
 * viene en el PDF de la orden de compra, que la persona adjunta en Gmail.
 */
export function correoSucursalNoCreada(d: { cadena: string; nit: string | null; eanEntrega: string; numeroOrden: string | null }) {
  const nit = d.nit ? ` (NIT ${d.nit})` : ''
  const asunto = `Crear sucursal en Siesa – ${d.cadena}${nit} – punto EAN ${d.eanEntrega}`
  const cuerpo = [
    'Buen día,',
    '',
    `Por favor crear en Siesa la sucursal del cliente ${d.cadena}${nit} para el punto de entrega con EAN ${d.eanEntrega}.`,
    '',
    `Cliente: ${d.cadena}`,
    `NIT: ${d.nit ?? 'por confirmar'}`,
    `EAN del punto de entrega: ${d.eanEntrega}`,
    '',
    `Se adjunta la orden de compra${d.numeroOrden ? ` ${d.numeroOrden}` : ''} con los datos del punto.`,
    '',
    'Gracias.',
  ].join('\n')
  return { asunto, cuerpo }
}

/** Enlace que abre Gmail en el navegador con el correo ya escrito (el adjunto se agrega a mano). */
export function enlaceGmail(c: { para: string[]; cc: string[]; asunto: string; cuerpo: string }): string {
  const q = [
    'view=cm', 'fs=1',
    `to=${encodeURIComponent(c.para.join(','))}`,
    ...(c.cc.length ? [`cc=${encodeURIComponent(c.cc.join(','))}`] : []),
    `su=${encodeURIComponent(c.asunto)}`,
    `body=${encodeURIComponent(c.cuerpo)}`,
  ]
  return `https://mail.google.com/mail/?${q.join('&')}`
}
