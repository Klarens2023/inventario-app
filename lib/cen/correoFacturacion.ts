// Arma el correo de aviso a facturación con los pedidos creados en Siesa (lib/cen/avisoFacturacion.ts).
// Sin dependencias de servidor ni imports relativos, para poder probarlo (tests/correo-facturacion.test.ts).
//
// Los pedidos van agrupados por relación de despacho (ruta + semana), con los institucionales de esa
// relación marcados como tales, y totales por relación y generales. El HTML usa tablas y estilos en
// línea para que se vea igual en Gmail, Outlook y el celular.

export interface PedidoAviso {
  id: number
  pedido: string // PVS-123 / PVK-456
  oc: string | null // número de la OC; null en los institucionales
  institucional: boolean
  cadena: string
  razon_social: string
  nit: string | null
  sucursal: string | null
  ciudad: string | null
  ruta: string | null
  relacion: string // RUTA-MMSS o "Sin ruta"
  fecha_entrega: string | null // AAAA-MM-DD
  unidades: number
  peso_kg: number | null
  valor: number
  retenido: string | null // motivo de retención en Siesa
  creado_por: string | null
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const moneda = (v: number) => '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v)
const numero = (v: number, dec = 0) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: dec }).format(v)
const fecha = (s: string | null) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—'
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`

/** Agrupa por relación conservando el orden de entrada dentro de cada una. */
export function porRelacion(pedidos: PedidoAviso[]): [string, PedidoAviso[]][] {
  const m = new Map<string, PedidoAviso[]>()
  for (const p of pedidos) { if (!m.has(p.relacion)) m.set(p.relacion, []); m.get(p.relacion)!.push(p) }
  return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b))
}

const rutasDe = (pedidos: PedidoAviso[]) => Array.from(new Set(pedidos.map(p => p.ruta).filter((r): r is string => Boolean(r)))).sort()

/** "Pedidos a facturar · Ruta DISTRYCAR · Relación DISTRYCAR-1146 · 3 pedidos" */
export function asuntoAviso(pedidos: PedidoAviso[]): string {
  const rutas = rutasDe(pedidos)
  const rels = porRelacion(pedidos).map(([r]) => r).filter(r => r !== 'Sin ruta')
  const partes = ['Pedidos a facturar']
  if (rutas.length === 1) partes.push(`Ruta ${rutas[0]}`)
  else if (rutas.length > 1) partes.push(`Rutas ${rutas.join(', ')}`)
  else partes.push('Sin ruta')
  if (rels.length === 1) partes.push(`Relación ${rels[0]}`)
  partes.push(plural(pedidos.length, 'pedido', 'pedidos'))
  return partes.join(' · ')
}

/** Línea de un pedido para los totales por ítem y por cliente (opcional en el correo). */
export interface LineaAviso {
  orden_id: number
  item: number | null // ítem de Siesa
  descripcion: string
  unidad: 'UND' | 'KG'
  cantidad: number
  kg: number | null // null si el producto no tiene peso en el maestro
  valor: number
}

export interface TotalItem { item: number | null; descripcion: string; unidades: number; kg: number; kgCompleto: boolean; valor: number }

/** Totales por ítem de Siesa (las líneas en kilos no suman a unidades). Ordenados por valor. */
export function totalesPorItem(lineas: LineaAviso[]): TotalItem[] {
  const m = new Map<string, TotalItem>()
  for (const l of lineas) {
    const k = l.item !== null ? `I${l.item}` : l.descripcion
    const t = m.get(k) ?? { item: l.item, descripcion: l.descripcion, unidades: 0, kg: 0, kgCompleto: true, valor: 0 }
    if (l.unidad !== 'KG') t.unidades += l.cantidad
    if (l.kg === null) t.kgCompleto = false; else t.kg += l.kg
    t.valor += l.valor
    m.set(k, t)
  }
  return Array.from(m.values()).sort((a, b) => b.valor - a.valor)
}

export interface TotalCliente { cliente: string; detalle: string; pedidos: number; unidades: number; kg: number; kgCompleto: boolean; valor: number; items: TotalItem[] }

/** Totales por cliente (razón social + NIT/sucursal) con sus ítems. Ordenados por valor. */
export function totalesPorCliente(pedidos: PedidoAviso[], lineas: LineaAviso[]): TotalCliente[] {
  const m = new Map<string, { cliente: string; detalle: string; ids: Set<number> }>()
  for (const p of pedidos) {
    const k = `${p.razon_social}|${p.nit ?? ''}|${p.sucursal ?? ''}`
    const c = m.get(k) ?? { cliente: p.razon_social, detalle: [p.nit && `${p.nit}/${p.sucursal ?? ''}`, p.ciudad].filter(Boolean).join(' · '), ids: new Set<number>() }
    c.ids.add(p.id); m.set(k, c)
  }
  return Array.from(m.values()).map(c => {
    const items = totalesPorItem(lineas.filter(l => c.ids.has(l.orden_id)))
    return {
      cliente: c.cliente, detalle: c.detalle, pedidos: c.ids.size, items,
      unidades: items.reduce((s, i) => s + i.unidades, 0), kg: items.reduce((s, i) => s + i.kg, 0),
      kgCompleto: items.every(i => i.kgCompleto), valor: items.reduce((s, i) => s + i.valor, 0),
    }
  }).sort((a, b) => b.valor - a.valor)
}

// Paleta del correo
const C = { azul: '#1E3A8A', azulClaro: '#EEF4FF', borde: '#E2E8F0', texto: '#0F172A', gris: '#64748B', fondo: '#F1F5F9', rojo: '#B91C1C', rojoClaro: '#FEF2F2', morado: '#6D28D9', moradoClaro: '#F3EEFF' }

export function armarCorreoFacturacion(pedidos: PedidoAviso[], opciones: { urlApp?: string; avisadoPor: string; lineas?: LineaAviso[] }): { asunto: string; html: string; texto: string } {
  const grupos = porRelacion(pedidos)
  const total = (ps: PedidoAviso[]) => ({
    valor: ps.reduce((s, p) => s + p.valor, 0),
    unidades: ps.reduce((s, p) => s + p.unidades, 0),
    peso: ps.every(p => p.peso_kg !== null) ? ps.reduce((s, p) => s + (p.peso_kg ?? 0), 0) : null,
  })
  const tg = total(pedidos)
  const retenidos = pedidos.filter(p => p.retenido)
  const institucionales = pedidos.filter(p => p.institucional).length
  const rutas = rutasDe(pedidos)
  const deRuta = rutas.length > 1 ? 'de estas rutas' : rutas.length === 1 ? 'de esta ruta' : 'creados'
  const titulo = rutas.length === 1 ? `Ruta ${rutas[0]}` : rutas.length > 1 ? `Rutas ${rutas.join(', ')}` : 'Pedidos sin ruta'

  const td = `padding:10px 12px;border-bottom:1px solid ${C.borde};font-size:13px;vertical-align:top;color:${C.texto}`
  const th = `padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${C.gris};text-align:left;border-bottom:2px solid ${C.borde}`
  const der = ';text-align:right;white-space:nowrap'
  const tdc = `padding:5px 10px;border-bottom:1px solid ${C.borde};font-size:12px;vertical-align:top;color:${C.texto}`
  const etiqueta = (txt: string, fg: string, bg: string) =>
    `<span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:.03em;color:${fg};background:${bg}">${txt}</span>`

  const indicador = (valor: string, nombre: string) => `
    <td style="padding:12px 8px;text-align:center;background:${C.azulClaro};border-radius:8px">
      <div style="font-size:18px;font-weight:800;color:${C.azul}">${valor}</div>
      <div style="font-size:11px;color:${C.gris};margin-top:2px">${nombre}</div>
    </td>`
  const indicadores = [
    indicador(numero(pedidos.length), pedidos.length === 1 ? 'pedido' : 'pedidos'),
    indicador(numero(tg.unidades, 1), 'unidades'),
    ...(tg.peso === null ? [] : [indicador(`${numero(tg.peso, 1)} kg`, 'peso')]),
    indicador(moneda(tg.valor), 'valor antes de IVA'),
  ].join('<td style="width:8px"></td>')

  // Totales por ítem y por cliente (si se pidieron): tablas compactas debajo de cada relación
  const kgTxt = (kg: number, completo: boolean) => `${numero(kg, 1)} kg${completo ? '' : '*'}`
  const tablaItems = (items: TotalItem[], titulo: string) => `
      <tr><td style="padding:14px 0 6px;font-size:13px;font-weight:800;color:${C.texto}">${esc(titulo)}</td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.borde}">
          <thead><tr><th style="${th}">Ítem</th><th style="${th}">Producto</th><th style="${th};text-align:right">Unidades</th><th style="${th};text-align:right">Kilos</th><th style="${th};text-align:right">Valor</th></tr></thead>
          <tbody>${items.map(i => `<tr><td style="${tdc}">${i.item ?? '—'}</td><td style="${tdc}">${esc(i.descripcion)}</td>
            <td style="${tdc}${der}">${i.unidades ? numero(i.unidades, 1) : '—'}</td><td style="${tdc}${der}">${kgTxt(i.kg, i.kgCompleto)}</td><td style="${tdc}${der}">${moneda(i.valor)}</td></tr>`).join('')}</tbody>
          <tfoot><tr style="background:${C.fondo}"><td colspan="2" style="${tdc};font-weight:700">Total</td>
            <td style="${tdc}${der};font-weight:700">${numero(items.reduce((s, i) => s + i.unidades, 0), 1)}</td>
            <td style="${tdc}${der};font-weight:700">${kgTxt(items.reduce((s, i) => s + i.kg, 0), items.every(i => i.kgCompleto))}</td>
            <td style="${tdc}${der};font-weight:700">${moneda(items.reduce((s, i) => s + i.valor, 0))}</td></tr></tfoot>
        </table>
      </td></tr>`
  const tablaClientes = (clientes: TotalCliente[]) => `
      <tr><td style="padding:14px 0 6px;font-size:13px;font-weight:800;color:${C.texto}">Totales por cliente</td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.borde}">
          <thead><tr><th style="${th}">Cliente / producto</th><th style="${th};text-align:right">Unidades</th><th style="${th};text-align:right">Kilos</th><th style="${th};text-align:right">Valor</th></tr></thead>
          <tbody>${clientes.map(c => `<tr style="background:${C.azulClaro}"><td style="${tdc};font-weight:700">${esc(c.cliente)}<span style="font-weight:400;color:${C.gris}"> · ${plural(c.pedidos, 'pedido', 'pedidos')}${c.detalle ? ` · ${esc(c.detalle)}` : ''}</span></td>
            <td style="${tdc}${der};font-weight:700">${numero(c.unidades, 1)}</td><td style="${tdc}${der};font-weight:700">${kgTxt(c.kg, c.kgCompleto)}</td><td style="${tdc}${der};font-weight:700">${moneda(c.valor)}</td></tr>` +
            c.items.map(i => `<tr><td style="${tdc};padding-left:22px;color:${C.gris}">${i.item ? `${i.item} · ` : ''}${esc(i.descripcion)}</td>
            <td style="${tdc}${der};color:${C.gris}">${i.unidades ? numero(i.unidades, 1) : '—'}</td><td style="${tdc}${der};color:${C.gris}">${kgTxt(i.kg, i.kgCompleto)}</td><td style="${tdc}${der};color:${C.gris}">${moneda(i.valor)}</td></tr>`).join('')).join('')}</tbody>
        </table>
      </td></tr>`
  const lineasDe = (ps: PedidoAviso[]) => { const ids = new Set(ps.map(p => p.id)); return (opciones.lineas ?? []).filter(l => ids.has(l.orden_id)) }

  const secciones = grupos.map(([rel, ps]) => {
    const t = total(ps)
    const totales = opciones.lineas ? tablaItems(totalesPorItem(lineasDe(ps)), `Totales por ítem · ${rel}`) + tablaClientes(totalesPorCliente(ps, lineasDe(ps))) : ''
    const filas = ps.map(p => {
      const cliente = [p.nit && `NIT ${p.nit}${p.sucursal ? ` · suc. ${p.sucursal}` : ''}`, p.ciudad].filter(Boolean).join(' · ')
      return `
        <tr${p.retenido ? ` style="background:${C.rojoClaro}"` : ''}>
          <td style="${td};white-space:nowrap"><strong>${esc(p.pedido)}</strong><br>${p.institucional ? etiqueta('INSTITUCIONAL', C.morado, C.moradoClaro) : `<span style="font-size:12px;color:${C.gris}">OC ${esc(p.oc)}</span>`}</td>
          <td style="${td}">${esc(p.razon_social)}<br><span style="font-size:12px;color:${C.gris}">${esc(p.institucional ? cliente : [p.cadena, cliente].filter(Boolean).join(' · '))}</span>
            ${p.retenido ? `<br><span style="font-size:12px;font-weight:700;color:${C.rojo}">⚠ ${esc(p.retenido)}</span>` : ''}</td>
          <td style="${td};white-space:nowrap">${fecha(p.fecha_entrega)}</td>
          <td style="${td}${der}">${numero(p.unidades, 1)}<br><span style="font-size:12px;color:${C.gris}">${p.peso_kg === null ? '' : numero(p.peso_kg, 1) + ' kg'}</span></td>
          <td style="${td}${der};font-weight:700">${moneda(p.valor)}</td>
        </tr>`
    }).join('')
    return `
      <tr><td style="padding:24px 0 8px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:15px;font-weight:800;color:${C.azul}">Relación ${esc(rel)}</td>
          <td style="font-size:12px;color:${C.gris};text-align:right">${plural(ps.length, 'pedido', 'pedidos')} · ${moneda(t.valor)}</td>
        </tr></table>
      </td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.borde};border-radius:8px">
          <thead><tr><th style="${th}">Pedido</th><th style="${th}">Cliente</th><th style="${th}">Entrega</th><th style="${th};text-align:right">Unid. / peso</th><th style="${th};text-align:right">Valor</th></tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr style="background:${C.fondo}">
            <td colspan="3" style="${td};font-weight:700;border-bottom:none">Total relación ${esc(rel)}</td>
            <td style="${td}${der};font-weight:700;border-bottom:none">${numero(t.unidades, 1)}${t.peso === null ? '' : `<br><span style="font-size:12px;font-weight:400;color:${C.gris}">${numero(t.peso, 1)} kg</span>`}</td>
            <td style="${td}${der};font-weight:800;border-bottom:none">${moneda(t.valor)}</td>
          </tr></tfoot>
        </table>
      </td></tr>${totales}`
  }).join('') + (opciones.lineas && grupos.length > 1 ? tablaItems(totalesPorItem(opciones.lineas), 'Total por ítem de todas las relaciones') : '')

  const resumen = `${plural(pedidos.length, 'pedido quedó creado', 'pedidos quedaron creados')} en Siesa${institucionales ? `, de los cuales ${plural(institucionales, 'es institucional', 'son institucionales')}` : ''}.`

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${C.fondo}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo};font-family:Arial,Helvetica,sans-serif">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid ${C.borde}">
        <tr><td style="background:${C.azul};padding:20px 24px">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#BFDBFE">Pedidos a facturar</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF;margin-top:4px">${esc(titulo)}</div>
        </td></tr>
        <tr><td style="padding:24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:14px;line-height:1.6;color:${C.texto}">
              Buen día, equipo de facturación:<br>
              Les compartimos los pedidos ${deRuta} para su facturación. ${resumen}
            </td></tr>
            <tr><td style="padding-top:16px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${indicadores}</tr></table>
            </td></tr>
            ${retenidos.length ? `<tr><td style="padding-top:16px">
              <div style="background:${C.rojoClaro};border-left:4px solid ${C.rojo};padding:10px 14px;font-size:13px;color:${C.rojo};border-radius:4px">
                <strong>Atención:</strong> ${plural(retenidos.length, 'pedido quedó retenido', 'pedidos quedaron retenidos')} en Siesa (${retenidos.map(p => esc(p.pedido)).join(', ')}). Por favor ${retenidos.length === 1 ? 'revísenlo' : 'revísenlos'} antes de facturar.
              </div>
            </td></tr>` : ''}
            ${secciones}
            <tr><td style="padding-top:24px;font-size:14px;line-height:1.6;color:${C.texto}">
              Quedamos atentos a cualquier novedad.<br>Gracias.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:${C.fondo};padding:14px 24px;font-size:11px;line-height:1.5;color:${C.gris}">
          Enviado por ${esc(opciones.avisadoPor)} desde la app de Operaciones${opciones.urlApp ? ` · <a href="${esc(opciones.urlApp)}/logistica/ordenes-cen" style="color:${C.azul}">Ver órdenes EDI</a>` : ''}.<br>
          Valores antes de IVA.${opciones.lineas?.some(l => l.kg === null) ? ' * Kilos incompletos: hay productos sin peso en el maestro.' : ''}${institucionales ? ' Los pedidos INSTITUCIONALES se crearon directamente en Siesa y se agregaron a la ruta.' : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const texto = [
    `PEDIDOS A FACTURAR · ${titulo.toUpperCase()}`,
    '',
    'Buen día, equipo de facturación:',
    `Les compartimos los pedidos ${deRuta} para su facturación. ${resumen}`,
    `Total: ${numero(tg.unidades, 1)} unidades${tg.peso === null ? '' : ` · ${numero(tg.peso, 1)} kg`} · ${moneda(tg.valor)} antes de IVA.`,
    ...(retenidos.length ? ['', `ATENCIÓN: ${plural(retenidos.length, 'pedido retenido', 'pedidos retenidos')} en Siesa, revisar antes de facturar.`] : []),
    ...grupos.flatMap(([rel, ps]) => ['', `Relación ${rel} (${moneda(total(ps).valor)}):`, ...ps.map(p =>
      `- ${p.pedido}${p.institucional ? ' (INSTITUCIONAL)' : ` · OC ${p.oc}`} · ${p.razon_social} · entrega ${fecha(p.fecha_entrega)} · ${moneda(p.valor)}${p.retenido ? ` · ⚠ ${p.retenido}` : ''}`)]),
    ...(opciones.lineas ? ['', 'Totales por ítem:', ...totalesPorItem(opciones.lineas).map(i =>
      `- ${i.item ?? ''} ${i.descripcion}: ${i.unidades ? `${numero(i.unidades, 1)} und · ` : ''}${kgTxt(i.kg, i.kgCompleto)} · ${moneda(i.valor)}`)] : []),
    '', 'Quedamos atentos a cualquier novedad. Gracias.',
    '', `Enviado por ${opciones.avisadoPor} desde la app de Operaciones.`,
  ].join('\n')

  return { asunto: asuntoAviso(pedidos), html, texto }
}
