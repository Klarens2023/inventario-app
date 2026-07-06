import type { MovimientoDetalle } from '@/types/movimientos'

const TIPOS_COL1 = [
  'Asignación / Reasignación', 'Traslado Interno', 'Cambio de responsable',
  'Salida por mantenimiento o servicio', 'Préstamo',
]
const TIPOS_COL2 = [
  'Devolución', 'Baja / disposición final', 'Movimiento excepcional',
  'Control / movimiento de estibas', 'Herramientas y equipos menores',
]
const MOTIVOS_COL1 = [
  'Inicio de Labores', 'Cambio de cargo / dependencia', 'Necesidad Operativa',
  'Mantenimiento / Reparación', 'Calibración / Verificación',
]
const MOTIVOS_COL2 = [
  'Evento, bienestar o actividad institucional',
  'Cumplimiento normativo / auditoría',
  'Daño, obsolescencia o pérdida',
  'Control logístico de estibas',
  'Control de herramientas de terceros / técnicos',
]

const S = '#2E75B6'  // azul sección — texto blanco
const L = '#c5d9f1'  // azul claro — th de tablas

function chk(val: boolean) {
  return `<span style="display:inline-block;width:11px;height:11px;border:1px solid #000;` +
    `text-align:center;line-height:10px;font-size:9px;font-weight:bold;">${val ? 'X' : '&nbsp;'}</span>`
}

export function imprimirMovimiento(mov: MovimientoDetalle, baseUrl = '') {
  const [anio, mes, dia] = (mov.fecha || '').split('-')
  const totalActivos = mov.activos.reduce((s, a) => s + a.cantidad, 0)
  const nroConsec    = mov.id.replace('TIC-', '')
  const logoKlarens  = `${baseUrl}/Klarens-logo.png`
  const logoHseq     = `${baseUrl}/hseq-logo.png`

  const activosRows = Array.from({ length: Math.max(10, mov.activos.length) }, (_, i) => {
    const a = mov.activos[i]
    return `<tr style="height:20px;">
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;">${a?.equipo_id ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;">${a?.descripcion ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;text-align:center;">${a?.cantidad ?? ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:8pt;">${a?.tipo_activo ?? ''}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Movimiento ${mov.id}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
      color-adjust:exact !important; }
  body { font-family:Arial,sans-serif; font-size:8.5pt; color:#000; }
  table { border-collapse:collapse; width:100%; }
  td,th { vertical-align:middle; }
  @page { size:A4 portrait; margin:8mm; }
  @media print { body { font-size:8pt; } }
</style>
</head><body>

<!-- ENCABEZADO: HSEQ(rowspan=4) | 6 cols | Klarens(rowspan=4) -->
<table style="margin-bottom:0;">
  <tr>
    <td rowspan="4" style="border:1px solid #000;width:14%;text-align:center;padding:4px;vertical-align:middle;">
      <img src="${logoHseq}" alt="HSEQ" style="max-width:95%;max-height:65px;object-fit:contain;"/>
    </td>
    <td colspan="6" style="border:1px solid #000;text-align:center;padding:3px 4px;font-weight:bold;font-size:8.5pt;">
      SISTEMA INTEGRADO HSEQ
    </td>
    <td rowspan="4" style="border:1px solid #000;width:13%;text-align:center;padding:4px;vertical-align:middle;">
      <img src="${logoKlarens}" alt="Klarens" style="max-width:95%;max-height:55px;object-fit:contain;"/>
    </td>
  </tr>
  <tr>
    <td colspan="6" style="border:1px solid #000;text-align:center;padding:5px 4px;font-weight:bold;font-size:11pt;">
      FORMATO UNICO PARA EL MOVIMIENTO Y CONTROL DE ACTIVOS
    </td>
  </tr>
  <tr>
    <td style="border:1px solid #000;width:13%;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Código</td>
    <td style="border:1px solid #000;width:20%;font-size:7.5pt;text-align:center;padding:2px 4px;">FR-AI-01</td>
    <td style="border:1px solid #000;width:13%;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Proceso</td>
    <td style="border:1px solid #000;width:8%;font-size:7.5pt;text-align:center;padding:2px 4px;">AI</td>
    <td style="border:1px solid #000;width:8%;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Ver</td>
    <td style="border:1px solid #000;width:7%;font-size:7.5pt;text-align:center;padding:2px 4px;">1</td>
  </tr>
  <tr>
    <td colspan="2" style="border:1px solid #000;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Fecha de Creación</td>
    <td colspan="2" style="border:1px solid #000;font-size:7.5pt;text-align:center;padding:2px 4px;">16/02/2026</td>
    <td style="border:1px solid #000;font-size:7.5pt;font-weight:bold;text-align:center;padding:2px 4px;">Pág</td>
    <td style="border:1px solid #000;font-size:7.5pt;text-align:center;padding:2px 4px;">1</td>
  </tr>
</table>

<!-- FECHA / CONSECUTIVO -->
<table style="margin-top:3px;margin-bottom:0;border-collapse:collapse;">
  <tr>
    <td colspan="5" style="border:none;padding:0;"></td>
    <td style="border:none;padding:0;"></td>
    <td style="border:none;font-size:6.5pt;font-weight:bold;text-align:center;padding:0 2px;">Codigo</td>
    <td style="border:none;font-size:6.5pt;font-weight:bold;text-align:center;padding:0 2px;">Número</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;width:8%;font-weight:bold;padding:3px 5px;">FECHA:</td>
    <td style="border:1px solid #000;width:5%;text-align:center;padding:3px;">${dia}</td>
    <td style="border:1px solid #000;width:5%;text-align:center;padding:3px;">${mes}</td>
    <td style="border:1px solid #000;width:7%;text-align:center;padding:3px;">${anio}</td>
    <td style="border:none;width:37%;padding:0;"></td>
    <td style="border:1px solid #000;width:20%;font-weight:bold;text-align:right;padding:3px 6px;white-space:nowrap;">CONSECUTIVO No.</td>
    <td style="border:1px solid #000;width:9%;text-align:center;font-weight:bold;padding:3px;">TIC</td>
    <td style="border:1px solid #000;width:9%;text-align:center;padding:3px;">${nroConsec}</td>
  </tr>
</table>

<!-- MOVIMIENTO -->
<table style="margin-top:4px;margin-bottom:3px;">
  <tr>
    <td style="border:none;width:14%;font-weight:bold;padding:3px 0;">MOVIMIENTO:</td>
    <td style="border:none;width:16%;padding:3px 8px;font-weight:bold;">DEFINITIVO &nbsp;${chk(mov.movimiento === 'definitivo')}</td>
    <td style="border:none;width:13%;padding:3px 8px;font-weight:bold;">TEMPORAL &nbsp;${chk(mov.movimiento === 'temporal')}</td>
    <td style="border:none;padding:3px 8px;font-style:italic;font-size:8pt;">(Aplica devolución obligatoria) &nbsp;${chk(mov.movimiento === 'temporal')}</td>
  </tr>
</table>

<!-- TIPO DE MOVIMIENTO -->
<table style="margin-bottom:3px;border:1px solid #000;">
  <tr>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px 5px;border-bottom:1px solid #000;">TIPO DE MOVIMIENTO:</td>
  </tr>
  <tr>
    <td style="width:50%;vertical-align:top;padding:2px 6px;border-right:1px solid #000;">
      ${TIPOS_COL1.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${t}&nbsp;${chk(mov.tipo_movimiento === t)}</div>`).join('')}
    </td>
    <td style="width:50%;vertical-align:top;padding:2px 6px;">
      ${TIPOS_COL2.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${t}&nbsp;${chk(mov.tipo_movimiento === t)}</div>`).join('')}
    </td>
  </tr>
</table>

<!-- MOTIVO DEL MOVIMIENTO -->
<table style="margin-bottom:3px;border:1px solid #000;">
  <tr>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px 5px;border-bottom:1px solid #000;">MOTIVO DEL MOVIMIENTO</td>
  </tr>
  <tr>
    <td style="width:50%;vertical-align:top;padding:2px 6px;border-right:1px solid #000;">
      ${MOTIVOS_COL1.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${m}&nbsp;${chk(mov.motivo === m)}</div>`).join('')}
    </td>
    <td style="width:50%;vertical-align:top;padding:2px 6px;">
      ${MOTIVOS_COL2.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:1px 0;">${m}&nbsp;${chk(mov.motivo === m)}</div>`).join('')}
    </td>
  </tr>
</table>

<!-- ORIGEN / DESTINO -->
<table style="margin-bottom:0;">
  <tr>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">DEPENDENCIA DE ORIGEN (ENTREGA)</td>
    <td colspan="2" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">DESTINO (RECIBE)</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;width:12%;font-weight:bold;font-size:8pt;padding:2px 5px;">Nombre</td>
    <td style="border:1px solid #000;width:38%;font-size:8pt;padding:2px 5px;text-align:center;">${mov.origen_nombre}</td>
    <td style="border:1px solid #000;width:12%;font-weight:bold;font-size:8pt;padding:2px 5px;">Nombre</td>
    <td style="border:1px solid #000;width:38%;font-size:8pt;padding:2px 5px;text-align:center;">${mov.destino_nombre}</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">No. De Documento</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.origen_documento}</td>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">No. De Documento</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.destino_documento}</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">Dependencia</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.origen_area}</td>
    <td style="border:1px solid #000;font-weight:bold;font-size:8pt;padding:2px 5px;">Dependencia</td>
    <td style="border:1px solid #000;font-size:8pt;padding:2px 5px;text-align:center;">${mov.destino_area}</td>
  </tr>
</table>

<!-- ACTIVOS -->
<table style="margin-bottom:0;">
  <tr>
    <td colspan="4" style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px 5px;border:1px solid #000;">INFORMACION BASICA DE LOS ACTIVOS</td>
  </tr>
  <tr>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:14%;font-size:8pt;text-align:center;vertical-align:middle;">Código (Placa de Activo)</th>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:48%;font-size:8pt;text-align:center;">Descripción del Activo</th>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:13%;font-size:8pt;text-align:center;">Cantidad</th>
    <th style="background:${L};border:1px solid #000;padding:2px 4px;width:25%;font-size:8pt;text-align:center;">Tipo de Activo</th>
  </tr>
  ${activosRows}
  <tr>
    <td colspan="2" style="border-top:1px solid #000;border-left:none;border-right:none;border-bottom:none;padding:3px 6px;font-weight:bold;font-size:8pt;">TOTAL ACTIVOS ENTREGADOS</td>
    <td style="border-bottom:1px solid #000;border-top:none;border-left:none;border-right:none;padding:3px;"></td>
    <td style="border:none;padding:3px;"></td>
  </tr>
</table>

<!-- CLÁUSULA -->
<table style="margin-top:3px;">
  <tr>
    <td style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">CLÁUSULA DE COMPROMISO</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;height:32px;padding:3px 6px;font-size:8pt;">
      Me comprometo a hacer buen uso del activo recibido, responder por su cuidado y a devolverlo en las mismas condiciones en que fue entregado.
    </td>
  </tr>
</table>

<!-- OBSERVACIONES -->
<table style="margin-top:3px;margin-bottom:3px;">
  <tr>
    <td style="background:${S};color:#fff;font-weight:bold;font-size:8.5pt;text-align:center;padding:3px;border:1px solid #000;">OBSERVACIONES</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;height:30px;padding:3px 6px;font-size:8.5pt;">${mov.observaciones ?? ''}</td>
  </tr>
</table>

<!-- FIRMAS -->
<table>
  <tr>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;height:55px;width:25%;vertical-align:bottom;padding-bottom:4px;">FIRMA QUIEN ENTREGA</td>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;width:25%;vertical-align:bottom;padding-bottom:4px;">FIRMA QUIEN RECIBE</td>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;width:25%;vertical-align:bottom;padding-bottom:4px;">FIRMA AUDITORÍA</td>
    <td style="border:1px solid #000;text-align:center;font-weight:bold;font-size:8pt;width:25%;vertical-align:bottom;padding-bottom:4px;">AUTORIZA<br/>(GERENCIA / DEPENDIENTE)</td>
  </tr>
</table>

<script>window.onload = function(){ window.print(); }</script>
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (w) { w.document.write(html); w.document.close() }
}
