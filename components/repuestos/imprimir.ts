import type {
  AsignacionImpresion, MovimientoImpresion, ReporteConsumo, FiltrosConsumo, DestinoRetiro,
} from '@/types/repuestos'
import { fetchAsignacionImpresion, fetchMovimientoImpresion } from '@/lib/api/repuestos'
import { escribirEImprimir } from '@/components/imprimirVentana'

// Encabezado de cada formato en el Sistema Integrado HSEQ.
// TODO: reemplazar 'Por asignar' por el código oficial cuando HSEQ lo apruebe.
const FORMATOS = {
  entrega:     { titulo: 'ACTA DE ENTREGA DE REPUESTOS, INSUMOS Y PERIFÉRICOS', codigo: 'Por asignar', version: '1', fecha: '20/10/2026' },
  retiro:      { titulo: 'ACTA DE DEVOLUCIÓN / RETIRO DE REPUESTOS Y PERIFÉRICOS', codigo: 'Por asignar', version: '1', fecha: '20/10/2026' },
  comprobante: { titulo: 'COMPROBANTE DE MOVIMIENTO DE INVENTARIO TIC', codigo: 'Por asignar', version: '1', fecha: '20/10/2026' },
  informe:     { titulo: 'INFORME DE CONSUMO Y GASTO DE REPUESTOS E INSUMOS TIC', codigo: 'Por asignar', version: '1', fecha: '20/10/2026' },
}
type Formato = keyof typeof FORMATOS

const S = '#2E75B6'  // azul sección — texto blanco
const L = '#c5d9f1'  // azul claro — th de tablas

const DESTINO_TXT: Record<DestinoRetiro, string> = {
  inventario: 'Regresa al inventario (funcional)',
  baja:       'Se da de baja (dañado / inservible)',
  garantia:   'Se envía a garantía',
  perdido:    'Perdido / no se recupera',
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
function fecha(s: string | null | undefined) {
  if (!s) return ''
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function pesos(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return '$' + Math.round(v).toLocaleString('es-CO')
}
function chk(val: boolean) {
  return `<span class="chk">${val ? 'X' : '&nbsp;'}</span>`
}
function seccion(titulo: string) {
  return `<tr><td colspan="8" class="sec">${titulo}</td></tr>`
}
const consec = (pref: string, n: number) => `${pref}-${String(n).padStart(6, '0')}`

function encabezado(f: Formato, baseUrl: string) {
  const d = FORMATOS[f]
  return `
<table>
  <tr>
    <td rowspan="4" class="b" style="width:14%;text-align:center;padding:4px;"><img src="${baseUrl}/hseq-logo.png" alt="HSEQ" style="max-width:95%;max-height:65px;"/></td>
    <td colspan="6" class="b c" style="font-weight:bold;padding:3px;">SISTEMA INTEGRADO HSEQ</td>
    <td rowspan="4" class="b" style="width:13%;text-align:center;padding:4px;"><img src="${baseUrl}/klarens-logo-print.png" alt="Klarens" style="max-width:95%;max-height:55px;"/></td>
  </tr>
  <tr><td colspan="6" class="b c" style="font-weight:bold;font-size:11pt;padding:5px 4px;">${d.titulo}</td></tr>
  <tr>
    <td class="b c h" style="width:13%;">Código</td><td class="b c s" style="width:20%;">${d.codigo}</td>
    <td class="b c h" style="width:13%;">Proceso</td><td class="b c s" style="width:8%;">TIC</td>
    <td class="b c h" style="width:8%;">Ver</td><td class="b c s" style="width:7%;">${d.version}</td>
  </tr>
  <tr>
    <td colspan="2" class="b c h">Fecha de Creación</td><td colspan="2" class="b c s">${d.fecha}</td>
    <td class="b c h">Pág</td><td class="b c s">1</td>
  </tr>
</table>`
}

function cabeceraDoc(fechaDoc: string, prefijo: string, numero: number) {
  const [y, m, d] = (fechaDoc || '').split('-')
  return `
<table style="margin-top:4px;">
  <tr>
    <td class="b" style="width:8%;font-weight:bold;padding:3px 5px;">FECHA:</td>
    <td class="b c" style="width:5%;">${d ?? ''}</td><td class="b c" style="width:5%;">${m ?? ''}</td><td class="b c" style="width:7%;">${y ?? ''}</td>
    <td style="width:37%;"></td>
    <td class="b" style="width:20%;font-weight:bold;text-align:right;padding:3px 6px;">CONSECUTIVO No.</td>
    <td class="b c" style="width:18%;font-weight:bold;">${consec(prefijo, numero)}</td>
  </tr>
</table>`
}

function firmas(etiquetas: [string, string][]) {
  const w = Math.floor(100 / etiquetas.length)
  return `
<table style="margin-top:6px;">
  <tr>${etiquetas.map(([t, n]) => `
    <td class="b" style="width:${w}%;height:62px;vertical-align:bottom;text-align:center;padding:3px;">
      <div style="border-top:1px solid #000;margin:0 10px 2px;"></div>
      <div style="font-weight:bold;font-size:7.5pt;">${t}</div>
      <div style="font-size:7.5pt;">${esc(n)}</div>
      <div style="font-size:7pt;color:#333;text-align:left;margin-top:2px;">C.C.</div>
    </td>`).join('')}
  </tr>
</table>`
}

function documento(titulo: string, cuerpo: string, horizontal = false) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(titulo)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  body { font-family:Arial,sans-serif; font-size:8.5pt; color:#000; }
  table { border-collapse:collapse; width:100%; }
  td,th { vertical-align:middle; }
  .b { border:1px solid #000; }
  .c { text-align:center; }
  .h { font-weight:bold; font-size:7.5pt; padding:2px 4px; }
  .s { font-size:7.5pt; padding:2px 4px; }
  .sec { background:${S}; color:#fff; font-weight:bold; text-align:center; padding:3px; border:1px solid #000; }
  .lb { border:1px solid #000; font-weight:bold; padding:3px 5px; background:#f3f6fa; width:18%; }
  .vl { border:1px solid #000; padding:3px 5px; }
  .th { background:${L}; border:1px solid #000; padding:3px 4px; font-weight:bold; text-align:center; font-size:8pt; }
  .td { border:1px solid #000; padding:3px 4px; font-size:8pt; }
  .r { text-align:right; }
  .chk { display:inline-block; width:11px; height:11px; border:1px solid #000; text-align:center; line-height:10px; font-size:9px; font-weight:bold; }
  .nota { font-size:7.5pt; color:#333; margin-top:4px; }
  @page { size:A4 ${horizontal ? 'landscape' : 'portrait'}; margin:8mm; }
</style></head><body>${cuerpo}
</body></html>`
}

// La ventana se abre en el mismo clic (antes de consultar el servidor) para que el navegador no la bloquee
let ventanaPendiente: Window | null = null

function nuevaVentana(): Window | null {
  const w = window.open('', '_blank', 'width=950,height=720')
  if (!w) alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.')
  else w.document.write('<p style="font-family:Arial;padding:20px;color:#64748b">Preparando documento...</p>')
  return w
}

function abrir(html: string) {
  const w = ventanaPendiente ?? nuevaVentana()
  ventanaPendiente = null
  if (w) escribirEImprimir(w, html)
}

// Si al asignar no se escribió el nombre, se toma el usuario del equipo
const receptor = (a: { persona_nombre: string | null; equipo_usuario?: string | null }) => a.persona_nombre || a.equipo_usuario || ''

function bloqueReceptor(a: { equipo_id: string | null; tipo_equipo: string | null; equipo_marca: string | null; equipo_modelo: string | null;
  equipo_serie: string | null; persona_nombre: string | null; persona_area: string | null; equipo_area?: string | null; equipo_usuario?: string | null }) {
  return `
  <tr>
    <td class="lb">Nombre</td><td class="vl" colspan="3">${esc(receptor(a))}</td>
    <td class="lb">Área</td><td class="vl" colspan="3">${esc(a.persona_area || a.equipo_area)}</td>
  </tr>
  <tr>
    <td class="lb">Equipo</td>
    <td class="vl" colspan="7">${a.equipo_id
      ? `<b>${esc(a.equipo_id)}</b> — ${esc(a.tipo_equipo)} ${esc(a.equipo_marca)} ${esc(a.equipo_modelo)}${a.equipo_serie ? ` · Serial ${esc(a.equipo_serie)}` : ''}`
      : 'Sin equipo (entrega directa a la persona)'}</td>
  </tr>`
}

function tablaArticulo(filas: { codigo: string; descripcion: string; referencia: string | null; marca: string | null; cantidad: number; unidad: string; costo?: number | null }[], conCosto: boolean) {
  return `
  <tr>
    <th class="th" style="width:12%;">Código</th>
    <th class="th" colspan="${conCosto ? 3 : 4}">Descripción</th>
    <th class="th" style="width:16%;">Referencia / Marca</th>
    <th class="th" style="width:9%;">Cantidad</th>
    <th class="th" style="width:10%;">Unidad</th>
    ${conCosto ? '<th class="th" style="width:12%;">Costo unitario</th>' : ''}
  </tr>
  ${filas.map(f => `<tr>
    <td class="td c">${esc(f.codigo)}</td>
    <td class="td" colspan="${conCosto ? 3 : 4}">${esc(f.descripcion)}</td>
    <td class="td">${esc([f.referencia, f.marca].filter(Boolean).join(' · '))}</td>
    <td class="td c">${f.cantidad}</td>
    <td class="td c">${esc(f.unidad)}</td>
    ${conCosto ? `<td class="td r">${pesos(f.costo)}</td>` : ''}
  </tr>`).join('')}`
}

// ---------------- Acta de entrega (asignación a equipo o persona, incluye reemplazo) ----------------
export function imprimirActaEntrega(a: AsignacionImpresion, baseUrl = window.location.origin) {
  const tipoEntrega = a.reemplaza_a ? 'reemplazo' : a.equipo_id ? 'equipo' : 'persona'
  const cuerpo = `
${encabezado('entrega', baseUrl)}
${cabeceraDoc(a.fecha_asignacion, 'ASG', a.id)}
<table style="margin-top:4px;">
  ${seccion('TIPO DE ENTREGA')}
  <tr><td class="vl" colspan="8">
    Asignación a equipo ${chk(tipoEntrega === 'equipo')} &nbsp;&nbsp;
    Reemplazo en equipo ${chk(tipoEntrega === 'reemplazo')} &nbsp;&nbsp;
    Entrega a persona sin equipo ${chk(tipoEntrega === 'persona')} &nbsp;&nbsp;
    Préstamo ${chk(a.es_prestamo)}${a.es_prestamo ? ` &nbsp;— devolver a más tardar el <b>${fecha(a.fecha_limite_prestamo)}</b>` : ''}
    <div style="margin-top:2px;">Motivo: ${esc(a.motivo_entrega)}</div>
  </td></tr>
  ${seccion('RECIBE')}
  ${bloqueReceptor(a)}
  ${seccion('ARTÍCULO ENTREGADO')}
  ${tablaArticulo([{ codigo: a.articulo_codigo, descripcion: a.descripcion, referencia: a.referencia, marca: a.marca, cantidad: a.cantidad, unidad: a.unidad }], false)}
  ${a.reemplaza_a ? `
  ${seccion('ARTÍCULO RETIRADO POR REEMPLAZO')}
  <tr>
    <td class="lb">Artículo</td><td class="vl" colspan="3"><b>${esc(a.ant_codigo)}</b> ${esc(a.ant_descripcion)} (×${a.ant_cantidad ?? ''})</td>
    <td class="lb">Asignado desde</td><td class="vl" colspan="3">${fecha(a.ant_fecha)} · ${consec('ASG', a.reemplaza_a)}</td>
  </tr>
  <tr>
    <td class="lb">Motivo del reemplazo</td><td class="vl" colspan="7">${esc(a.ant_motivo)}${a.ant_detalle ? ` — ${esc(a.ant_detalle)}` : ''}</td>
  </tr>
  <tr>
    <td class="lb">Destino del retirado</td>
    <td class="vl" colspan="7">${(Object.keys(DESTINO_TXT) as DestinoRetiro[]).map(k => `${DESTINO_TXT[k]} ${chk(a.ant_destino === k)}`).join(' &nbsp;&nbsp; ')}</td>
  </tr>` : ''}
  ${seccion('CLÁUSULA DE COMPROMISO')}
  <tr><td class="vl" colspan="8" style="height:34px;">
    Me comprometo a hacer buen uso del artículo recibido, responder por su cuidado y reportar al área de Sistemas cualquier daño o pérdida.
    ${a.es_prestamo ? `Por tratarse de un préstamo, me comprometo a devolverlo a más tardar el <b>${fecha(a.fecha_limite_prestamo)}</b> en las mismas condiciones en que lo recibo.` : ''}
  </td></tr>
  ${seccion('OBSERVACIONES')}
  <tr><td class="vl" colspan="8" style="height:34px;">${esc(a.observaciones)}</td></tr>
</table>
${firmas([['ENTREGA (SISTEMAS)', a.registrado_por], ['RECIBE', receptor(a)], ['Vo.Bo. JEFE DE ÁREA', '']])}
<div class="nota">Registro ${consec('ASG', a.id)} generado desde el sistema de inventario TIC.</div>`
  abrir(documento(`Acta de entrega ${consec('ASG', a.id)}`, cuerpo))
}

// ---------------- Acta de devolución / retiro ----------------
export function imprimirActaRetiro(a: AsignacionImpresion, baseUrl = window.location.origin) {
  if (a.estado === 'vigente') { alert('Esta asignación sigue vigente: aún no tiene devolución.'); return }
  const cuerpo = `
${encabezado('retiro', baseUrl)}
${cabeceraDoc(a.fecha_retiro ?? '', 'RET', a.id)}
<table style="margin-top:4px;">
  ${seccion('TIPO DE RETIRO')}
  <tr><td class="vl" colspan="8">
    Devolución ${chk(a.estado === 'devuelto')} &nbsp;&nbsp; Retiro por reemplazo ${chk(a.estado === 'reemplazado')} &nbsp;&nbsp;
    Fin de préstamo ${chk(a.es_prestamo)}
    <div style="margin-top:2px;">Motivo: <b>${esc(a.motivo_retiro)}</b>${a.detalle_retiro ? ` — ${esc(a.detalle_retiro)}` : ''}</div>
  </td></tr>
  ${seccion('ENTREGA (QUIEN DEVUELVE)')}
  ${bloqueReceptor(a)}
  ${seccion('ARTÍCULO DEVUELTO / RETIRADO')}
  ${tablaArticulo([{ codigo: a.articulo_codigo, descripcion: a.descripcion, referencia: a.referencia, marca: a.marca, cantidad: a.cantidad, unidad: a.unidad }], false)}
  <tr>
    <td class="lb">Entregado el</td><td class="vl" colspan="3">${fecha(a.fecha_asignacion)} · ${consec('ASG', a.id)}</td>
    <td class="lb">Préstamo hasta</td><td class="vl" colspan="3">${a.es_prestamo ? fecha(a.fecha_limite_prestamo) : 'No aplica'}</td>
  </tr>
  ${seccion('DESTINO DEL ARTÍCULO')}
  <tr><td class="vl" colspan="8">
    ${(Object.keys(DESTINO_TXT) as DestinoRetiro[]).map(k => `${DESTINO_TXT[k]} ${chk(a.destino_retiro === k)}`).join(' &nbsp;&nbsp; ')}
    ${a.reemplazada_por ? `<div style="margin-top:3px;">Reemplazado por <b>${esc(a.nue_codigo)}</b> ${esc(a.nue_descripcion)} — ${consec('ASG', a.reemplazada_por)} del ${fecha(a.nue_fecha)}</div>` : ''}
  </td></tr>
  ${seccion('ESTADO EN QUE SE RECIBE / OBSERVACIONES')}
  <tr><td class="vl" colspan="8" style="height:40px;">${esc(a.detalle_retiro)}</td></tr>
</table>
${firmas([['ENTREGA (QUIEN DEVUELVE)', receptor(a)], ['RECIBE (SISTEMAS)', a.cerrado_por ?? ''], ['Vo.Bo. JEFE DE ÁREA', '']])}
<div class="nota">Registro ${consec('RET', a.id)} (asignación ${consec('ASG', a.id)}) generado desde el sistema de inventario TIC.</div>`
  abrir(documento(`Acta de retiro ${consec('RET', a.id)}`, cuerpo))
}

// ---------------- Comprobante de entrada / consumo / ajuste ----------------
export function imprimirComprobante(m: MovimientoImpresion, baseUrl = window.location.origin) {
  const esConsumo = m.tipo === 'salida'
  const unidades  = Math.abs(m.cantidad)
  const total     = m.costo_unitario != null ? unidades * m.costo_unitario : null
  const cuerpo = `
${encabezado('comprobante', baseUrl)}
${cabeceraDoc(m.fecha, 'MOV', m.id)}
<table style="margin-top:4px;">
  ${seccion('TIPO DE MOVIMIENTO')}
  <tr><td class="vl" colspan="8">
    Entrada ${chk(m.tipo === 'entrada')} &nbsp;&nbsp; Consumo / salida ${chk(esConsumo)} &nbsp;&nbsp; Ajuste por conteo ${chk(m.tipo === 'ajuste')}
    <div style="margin-top:2px;">Motivo: <b>${esc(m.motivo)}</b></div>
  </td></tr>
  ${seccion('ARTÍCULO')}
  ${tablaArticulo([{ codigo: m.articulo_codigo, descripcion: m.descripcion, referencia: m.referencia, marca: m.marca,
                     cantidad: m.tipo === 'ajuste' ? m.cantidad : unidades, unidad: m.unidad, costo: m.costo_unitario }], true)}
  <tr>
    <td class="lb">Stock anterior</td><td class="vl c">${m.stock_anterior}</td>
    <td class="lb">Stock resultante</td><td class="vl c">${m.stock_resultante}</td>
    <td class="lb">Valor total</td><td class="vl r" colspan="3"><b>${pesos(total)}</b></td>
  </tr>
  ${m.tipo === 'entrada' ? `
  ${seccion('PROVEEDOR')}
  <tr>
    <td class="lb">Proveedor</td><td class="vl" colspan="3">${esc(m.proveedor)}</td>
    <td class="lb">Factura / documento</td><td class="vl" colspan="3">${esc(m.documento_ref)}</td>
  </tr>` : ''}
  ${m.equipo_id || m.destino_nombre ? `
  ${seccion(esConsumo ? 'EQUIPO DONDE SE CONSUME' : 'EQUIPO / PERSONA RELACIONADA')}
  <tr>
    <td class="lb">Equipo</td>
    <td class="vl" colspan="7">${m.equipo_id ? `<b>${esc(m.equipo_id)}</b> — ${esc(m.tipo_equipo)} ${esc(m.equipo_marca)} ${esc(m.equipo_modelo)}${m.equipo_serie ? ` · Serial ${esc(m.equipo_serie)}` : ''}` : '—'}</td>
  </tr>
  <tr>
    <td class="lb">Usuario / Área</td><td class="vl" colspan="3">${esc([m.destino_nombre || m.equipo_usuario, m.destino_area || m.equipo_area].filter(Boolean).join(' · '))}</td>
    <td class="lb">Contador de páginas</td><td class="vl" colspan="3">${m.contador_paginas != null ? m.contador_paginas.toLocaleString('es-CO') : '—'}</td>
  </tr>` : ''}
  ${seccion('OBSERVACIONES')}
  <tr><td class="vl" colspan="8" style="height:36px;">${esc(m.observaciones)}</td></tr>
</table>
${firmas(m.tipo === 'entrada'
    ? [['REGISTRA / RECIBE (SISTEMAS)', m.registrado_por], ['ENTREGA (PROVEEDOR)', m.proveedor ?? ''], ['Vo.Bo.', '']]
    : esConsumo
      ? [['ENTREGA (SISTEMAS)', m.registrado_por], ['RECIBE / USUARIO DEL EQUIPO', m.destino_nombre ?? m.equipo_usuario ?? ''], ['Vo.Bo. JEFE DE ÁREA', '']]
      : [['REALIZA EL CONTEO', m.registrado_por], ['VERIFICA', ''], ['Vo.Bo.', '']])}
<div class="nota">Registro ${consec('MOV', m.id)} generado desde el sistema de inventario TIC.</div>`
  abrir(documento(`Comprobante ${consec('MOV', m.id)}`, cuerpo))
}

// ---------------- Informe de consumo y gasto ----------------
export function imprimirInformeConsumo(r: ReporteConsumo, f: FiltrosConsumo, generadoPor: string, baseUrl = window.location.origin) {
  const fila = (cols: (string | number)[], alinear: string[] = []) =>
    `<tr>${cols.map((c, i) => `<td class="td ${alinear[i] ?? ''}">${c}</td>`).join('')}</tr>`
  const filtros = [
    `Periodo: <b>${fecha(f.desde)} a ${fecha(f.hasta)}</b>`,
    f.categoria ? `Categoría: <b>${esc(f.categoria)}</b>` : '',
    f.equipo_id ? `Equipo: <b>${esc(f.equipo_id)}</b>` : '',
    f.area ? `Área: <b>${esc(f.area)}</b>` : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')

  const cuerpo = `
${encabezado('informe', baseUrl)}
<div style="margin:6px 0;font-size:8.5pt;">${filtros} &nbsp;·&nbsp; Generado el ${new Date().toLocaleDateString('es-CO')} por ${esc(generadoPor)}</div>
<table>
  <tr>
    <td class="lb c">Gasto neto</td><td class="lb c">Unidades</td><td class="lb c">Salidas</td><td class="lb c">Equipos con consumo</td>
  </tr>
  <tr>
    <td class="vl c" style="font-size:12pt;font-weight:bold;">${pesos(r.resumen.gasto)}</td>
    <td class="vl c" style="font-size:12pt;">${r.resumen.unidades}</td>
    <td class="vl c" style="font-size:12pt;">${r.resumen.salidas}</td>
    <td class="vl c" style="font-size:12pt;">${r.resumen.equipos}</td>
  </tr>
</table>
${r.resumen.sin_costo > 0 ? `<div class="nota">⚠ ${r.resumen.sin_costo} salida(s) sin costo registrado: el gasto real puede ser mayor.</div>` : ''}

<table style="margin-top:8px;">
  <tr><td colspan="8" class="sec">GASTO POR EQUIPO</td></tr>
  <tr>${['Equipo', 'Tipo / Marca / Modelo', 'Área', 'Usuario', 'Artículos', 'Salidas', 'Unidades', 'Gasto'].map(h => `<th class="th">${h}</th>`).join('')}</tr>
  ${r.por_equipo.map(e => fila([
    esc(e.equipo_id ?? 'Sin equipo'), esc([e.tipo_equipo, e.marca, e.modelo].filter(Boolean).join(' ')), esc(e.area),
    esc(e.usuario_asignado), esc(e.tipos), e.salidas, e.unidades, pesos(e.gasto),
  ], ['', '', '', '', '', 'c', 'c', 'r'])).join('')}
</table>

<table style="margin-top:8px;">
  <tr><td colspan="5" class="sec">GASTO POR ÁREA</td></tr>
  <tr>${['Área', 'Equipos', 'Unidades', 'Gasto', '% del gasto'].map(h => `<th class="th">${h}</th>`).join('')}</tr>
  ${r.por_area.map(a => fila([esc(a.area), a.equipos, a.unidades, pesos(a.gasto),
    r.resumen.gasto > 0 ? `${((a.gasto / r.resumen.gasto) * 100).toFixed(1)} %` : '—'], ['', 'c', 'c', 'r', 'r'])).join('')}
</table>

<table style="margin-top:8px;">
  <tr><td colspan="6" class="sec">CONSUMO POR ARTÍCULO</td></tr>
  <tr>${['Código', 'Artículo', 'Categoría', 'Equipos', 'Unidades', 'Gasto'].map(h => `<th class="th">${h}</th>`).join('')}</tr>
  ${r.por_articulo.map(a => fila([esc(a.articulo_codigo), esc(a.descripcion), esc(a.categoria), a.equipos, a.unidades, pesos(a.gasto)],
    ['c', '', '', 'c', 'c', 'r'])).join('')}
</table>

<table style="margin-top:8px;">
  <tr><td colspan="5" class="sec">EVOLUCIÓN MENSUAL (UNIDADES NETAS Y GASTO)</td></tr>
  <tr>${['Mes', 'Insumos', 'Repuestos', 'Periféricos', 'Gasto'].map(h => `<th class="th">${h}</th>`).join('')}</tr>
  ${r.por_mes.map(m => fila([m.mes, m.insumos ?? 0, m.repuestos ?? 0, m.perifericos ?? 0, pesos(m.gasto)], ['c', 'c', 'c', 'c', 'r'])).join('')}
</table>
<div class="nota">Unidades netas: salidas menos lo que regresó al inventario en el mes (un valor negativo indica devoluciones de meses anteriores).</div>

${r.rendimiento.length > 0 ? `
<table style="margin-top:8px;">
  <tr><td colspan="7" class="sec">RENDIMIENTO DE TÓNER / TINTA POR IMPRESORA</td></tr>
  <tr>${['Impresora', 'Insumo', 'Cambios medidos', 'Páginas por cambio', 'Días por cambio', 'Costo por página', 'Último contador'].map(h => `<th class="th">${h}</th>`).join('')}</tr>
  ${r.rendimiento.map(x => fila([
    `${esc(x.equipo_id)} ${esc([x.marca, x.modelo].filter(Boolean).join(' '))}`, `${esc(x.articulo_codigo)} ${esc(x.descripcion)}`,
    x.cambios, (x.paginas_promedio ?? 0).toLocaleString('es-CO'), x.dias_promedio ?? '—',
    x.costo_pagina != null ? `$${x.costo_pagina.toFixed(1)}` : '—', (x.ultimo_contador ?? 0).toLocaleString('es-CO'),
  ], ['', '', 'c', 'c', 'c', 'r', 'c'])).join('')}
</table>
<div class="nota">El rendimiento se calcula con la lectura del contador registrada en cada cambio: páginas impresas desde el cambio anterior del mismo insumo en la misma impresora.</div>` : ''}

${firmas([['ELABORA (SISTEMAS)', generadoPor], ['REVISA', ''], ['APRUEBA', '']])}`
  abrir(documento('Informe de consumo y gasto TIC', cuerpo, true))
}

// ---------------- Atajos por id ----------------
export async function imprimirAsignacion(id: number, cual: 'entrega' | 'retiro') {
  ventanaPendiente = ventanaPendiente ?? nuevaVentana()
  const a = await fetchAsignacionImpresion(id)
  if (!a) { ventanaPendiente?.close(); ventanaPendiente = null; alert('No se encontró la asignación'); return }
  if (cual === 'entrega') imprimirActaEntrega(a)
  else imprimirActaRetiro(a)
}

// Desde el kardex: si el movimiento creó o cerró una asignación, imprime el acta; si no, el comprobante
export async function imprimirMovimiento(id: number) {
  ventanaPendiente = nuevaVentana()
  const m = await fetchMovimientoImpresion(id)
  if (!m) { ventanaPendiente?.close(); ventanaPendiente = null; alert('No se encontró el movimiento'); return }
  if (m.asignacion_entrega) return imprimirAsignacion(m.asignacion_entrega, 'entrega')
  if (m.asignacion_retorno) return imprimirAsignacion(m.asignacion_retorno, 'retiro')
  imprimirComprobante(m)
}
