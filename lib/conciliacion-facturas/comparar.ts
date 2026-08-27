import type {
  FacturaInvoicing, DocumentoErp, ResultadoComparacion, ResumenProcesamiento, CandidatoErp,
} from '@/types/conciliacion-facturas'
import { normalizarNit, normalizarFactura, distanciaEdicion, sonFacturasEquivalentes } from './normalizar'

// Tipos de documento del ERP que representan causación de factura de
// proveedor (decidido junto con el usuario tras revisar los datos reales de
// julio 2026 — el resto, ej. EAL "entrada de leche cruda" o PE "pagos
// electrónicos", nunca traen "Docto. Proveedor" y no son facturas).
export const TIPOS_DOCTO_ERP_VALIDOS = [
  'CFP', 'FFC', 'FSC', 'DO', 'DC', 'DCO', 'AZ', 'CF', 'NCO', 'NCP', 'AW',
] as const

const TOLERANCIA_MONTO = 1 // pesos, por redondeos

type CandidatoInterno = CandidatoErp & { nitNormalizado: string; facturaNorm: ReturnType<typeof normalizarFactura> }

export function esNitValido(nit: string): boolean {
  const limpio = nit.trim().toUpperCase()
  return limpio !== '' && limpio !== 'INTERNOCG' && /\d/.test(limpio)
}

export function filtrarErpValidos(erp: DocumentoErp[]): DocumentoErp[] {
  return erp.filter(d =>
    TIPOS_DOCTO_ERP_VALIDOS.includes(d.tipoDocto.trim().toUpperCase() as typeof TIPOS_DOCTO_ERP_VALIDOS[number])
    && esNitValido(d.nit)
  )
}

// Un mismo "Docto." (consecutivo interno de Siesa) puede aparecer en varias
// filas del listado de causación — una por línea contable (débito, crédito,
// distintos centros de costo). Para la comparación un documento debe contar
// como UN solo candidato, no uno por línea; por eso se agrupan primero y el
// monto queda como lista (no hay una única "línea total" fiable a priori).
function agruparPorDocumento(erpValidos: DocumentoErp[]): CandidatoInterno[] {
  const porDocto = new Map<string, CandidatoInterno>()
  for (const d of erpValidos) {
    const nitNorm = normalizarNit(d.nit)
    if (!nitNorm) continue
    const clave = `${nitNorm}::${d.doctoInterno}`
    const existente = porDocto.get(clave)
    if (existente) {
      existente.montos.push(d.neto)
      if (!existente.doctoProveedorOriginal && d.doctoProveedorOriginal) {
        existente.doctoProveedorOriginal = d.doctoProveedorOriginal
        existente.facturaNorm = normalizarFactura(d.doctoProveedorOriginal)
      }
    } else {
      porDocto.set(clave, {
        doctoInterno: d.doctoInterno,
        doctoProveedorOriginal: d.doctoProveedorOriginal,
        montos: [d.neto],
        tipoDocto: d.tipoDocto,
        fecha: d.fecha,
        nitNormalizado: nitNorm,
        facturaNorm: normalizarFactura(d.doctoProveedorOriginal),
      })
    }
  }
  return Array.from(porDocto.values())
}

function algunMontoCoincide(montos: number[], valor: number): boolean {
  return montos.some(m => Math.abs(Math.abs(m) - valor) < TOLERANCIA_MONTO)
}

// Para mostrar en pantalla: si algún monto coincidió con la factura se
// muestra ese; si no, se muestra la línea de mayor magnitud (normalmente la
// más representativa del documento).
function montoParaMostrar(montos: number[], valor: number): number {
  const coincidente = montos.find(m => Math.abs(Math.abs(m) - valor) < TOLERANCIA_MONTO)
  if (coincidente !== undefined) return coincidente
  return montos.reduce((mayor, m) => Math.abs(m) > Math.abs(mayor) ? m : mayor, montos[0])
}

function aCandidatoErp({ nitNormalizado, facturaNorm, ...resto }: CandidatoInterno): CandidatoErp {
  return resto
}

export function compararFacturas(
  invoicing: FacturaInvoicing[],
  erp: DocumentoErp[],
): { resultados: ResultadoComparacion[]; resumen: ResumenProcesamiento; rechazadas: FacturaInvoicing[] } {
  const rechazadas = invoicing.filter(f => f.estadoDocto.trim().toLowerCase() === 'rechazada')
  const aProcesar = invoicing.filter(f => f.estadoDocto.trim().toLowerCase() !== 'rechazada')

  const documentos = agruparPorDocumento(filtrarErpValidos(erp))

  const porNit = new Map<string, CandidatoInterno[]>()
  for (const c of documentos) {
    const lista = porNit.get(c.nitNormalizado) ?? []
    lista.push(c)
    porNit.set(c.nitNormalizado, lista)
  }

  const resultados: ResultadoComparacion[] = aProcesar.map((f, idx) => {
    const nitNorm = normalizarNit(f.nit)
    const facturaNorm = normalizarFactura(f.facturaOriginal)
    const candidatos = porNit.get(nitNorm) ?? []

    const base = {
      id: idx + 1,
      nit: f.nit,
      razonSocial: f.razonSocial,
      facturaInvoicingOriginal: f.facturaOriginal,
      facturaInvoicingNormalizada: facturaNorm.normalizada,
      valorInvoicing: f.valor,
    }

    if (candidatos.length === 0) {
      return {
        ...base,
        facturaErpOriginal: null, facturaErpNormalizada: null, doctoInternoErp: null,
        montoErp: null, montoCoincide: false,
        estado: 'NO_CAUSADA', nivel: 'no_encontrada',
        observacion: 'No se encontraron documentos de causación en el ERP para este NIT en el período.',
        candidatosAlternos: [], duplicadoEnErp: false,
      } satisfies ResultadoComparacion
    }

    const conDocumento = candidatos.filter(c => c.facturaNorm.original !== '')

    // Nivel 1 — exacta (mismo texto tal cual, solo comparando recortado).
    const exactos = conDocumento.filter(c => c.facturaNorm.original.trim() === f.facturaOriginal.trim())
    if (exactos.length > 0) {
      const c = exactos[0]
      return {
        ...base,
        facturaErpOriginal: c.doctoProveedorOriginal, facturaErpNormalizada: c.facturaNorm.normalizada,
        doctoInternoErp: c.doctoInterno, montoErp: montoParaMostrar(c.montos, f.valor),
        montoCoincide: algunMontoCoincide(c.montos, f.valor),
        estado: 'CAUSADA', nivel: 'exacta',
        observacion: 'CAUSADA — el NIT y el número de factura coinciden exactamente con el documento registrado en ERP.',
        candidatosAlternos: exactos.slice(1).map(aCandidatoErp),
        duplicadoEnErp: false, // se recalcula en la segunda pasada (reuso entre filas, no candidatos ambiguos de una misma fila)
      } satisfies ResultadoComparacion
    }

    // Nivel 2 — equivalente tras normalizar formato. Incluye el caso de un
    // cero de más insertado justo en la frontera prefijo/número cuando el
    // lado de Invoicing no tiene separador para revelar dónde termina el
    // prefijo (ej. "EK031076078" vs "EK03-01076078" — mismo documento).
    const equivalentes = conDocumento.filter(c => sonFacturasEquivalentes(c.facturaNorm, facturaNorm))
    if (equivalentes.length > 0) {
      const c = equivalentes[0]
      return {
        ...base,
        facturaErpOriginal: c.doctoProveedorOriginal, facturaErpNormalizada: c.facturaNorm.normalizada,
        doctoInternoErp: c.doctoInterno, montoErp: montoParaMostrar(c.montos, f.valor),
        montoCoincide: algunMontoCoincide(c.montos, f.valor),
        estado: 'CAUSADA', nivel: 'equivalente',
        observacion: `CAUSADA — mismo NIT y mismo número tras normalizar formato (Invoicing: "${f.facturaOriginal}", ERP: "${c.doctoProveedorOriginal}").`,
        candidatosAlternos: equivalentes.slice(1).map(aCandidatoErp),
        duplicadoEnErp: false,
      } satisfies ResultadoComparacion
    }

    // Nivel 3 — probable. Requiere evidencia razonablemente fuerte, no solo
    // "se parecen los textos" (ver punto 8 del brief).
    //
    // OJO: números de factura consecutivos del mismo proveedor (ej. 2230 y
    // 2231) difieren en un solo caracter — igual que un error de digitación
    // real — así que la distancia de edición POR SÍ SOLA no alcanza para
    // distinguir "typo" de "factura distinta pero cercana". Por eso, salvo
    // que el número sea EXACTAMENTE igual (y solo cambie el prefijo, que sí
    // es fuerte por sí mismo), cualquier otra diferencia exige que el monto
    // de la factura coincida con el documento ERP como evidencia adicional.
    const probables = conDocumento
      .map(c => ({
        c,
        dist: distanciaEdicion(c.facturaNorm.normalizada, facturaNorm.normalizada),
        montoCoincide: algunMontoCoincide(c.montos, f.valor),
      }))
      .filter(({ c, dist, montoCoincide }) => {
        const mismoNumeroDistintoPrefijo = c.facturaNorm.numero !== '' && c.facturaNorm.numero === facturaNorm.numero
        const diferenciaConMonto = dist <= 2 && montoCoincide
        return mismoNumeroDistintoPrefijo || diferenciaConMonto
      })
      .sort((a, b) => a.dist - b.dist)
    if (probables.length > 0) {
      const { c, montoCoincide } = probables[0]
      const motivo = c.facturaNorm.prefijo !== facturaNorm.prefijo && c.facturaNorm.numero === facturaNorm.numero
        ? `el número coincide pero el prefijo difiere (Invoicing: "${facturaNorm.prefijo}", ERP: "${c.facturaNorm.prefijo}") — probable error de digitación del empleado al causar en ERP`
        : `difieren en pocos caracteres (Invoicing: "${facturaNorm.normalizada}", ERP: "${c.facturaNorm.normalizada}") — probable error de digitación del empleado al causar en ERP`
      // Se clasifica como CAUSADA (no como "requiere revisión"): el filtro de
      // este nivel ya exige, o bien el número idéntico (señal fuerte por sí
      // sola), o bien que el monto de la factura coincida exactamente con el
      // documento ERP — esa combinación es evidencia suficiente de que es la
      // misma factura con un error de digitación humano, no dos documentos
      // distintos. Queda "nivel: probable" para que se pueda auditar el
      // porqué (nunca es una "caja negra", ver punto 16 del brief).
      return {
        ...base,
        facturaErpOriginal: c.doctoProveedorOriginal, facturaErpNormalizada: c.facturaNorm.normalizada,
        doctoInternoErp: c.doctoInterno, montoErp: montoParaMostrar(c.montos, f.valor), montoCoincide,
        estado: 'CAUSADA', nivel: 'probable',
        observacion: `CAUSADA — coincidencia probable con el documento ERP "${c.doctoProveedorOriginal}": ${motivo}.`
          + (montoCoincide ? ' El valor de la factura coincide con el documento ERP, lo que confirma la hipótesis.' : ''),
        candidatosAlternos: probables.slice(1).map(({ c: c2 }) => aCandidatoErp(c2)),
        duplicadoEnErp: false,
      } satisfies ResultadoComparacion
    }

    // Nivel 4 — posible documento interno: mismo NIT, ningún número calza,
    // pero existe un documento (con o sin Docto. Proveedor, ej. tipo "CF")
    // cuyo valor coincide con el de la factura.
    const porMonto = candidatos.filter(c => algunMontoCoincide(c.montos, f.valor))
    if (porMonto.length > 0) {
      const c = porMonto[0]
      return {
        ...base,
        facturaErpOriginal: c.doctoProveedorOriginal || null, facturaErpNormalizada: c.facturaNorm.normalizada || null,
        doctoInternoErp: c.doctoInterno, montoErp: montoParaMostrar(c.montos, f.valor), montoCoincide: true,
        estado: 'REQUIERE_REVISION', nivel: 'documento_interno',
        observacion: `REQUIERE REVISIÓN — la factura recibida en Invoicing ("${f.facturaOriginal}") no coincide con ningún número registrado en ERP, pero el documento interno "${c.doctoInterno}" (tipo ${c.tipoDocto}) del mismo NIT tiene el mismo valor. Verificar si la factura fue causada usando un documento interno.`,
        candidatosAlternos: porMonto.slice(1).map(aCandidatoErp),
        duplicadoEnErp: false,
      } satisfies ResultadoComparacion
    }

    // Nivel 5 — no encontrada (hay documentos del NIT, pero ninguno calza).
    return {
      ...base,
      facturaErpOriginal: null, facturaErpNormalizada: null, doctoInternoErp: null,
      montoErp: null, montoCoincide: false,
      estado: 'NO_CAUSADA', nivel: 'no_encontrada',
      observacion: `NO CAUSADA — hay ${candidatos.length} documento(s) de este NIT en el ERP durante el período, pero ninguno coincide en número ni en valor con la factura "${f.facturaOriginal}".`,
      candidatosAlternos: [],
      duplicadoEnErp: false,
    } satisfies ResultadoComparacion
  })

  // Segunda pasada: marcar duplicados detectados por reutilización del mismo
  // documento ERP en más de un resultado CAUSADA (posible pago/causación
  // duplicada, o dos facturas de Invoicing apuntando al mismo documento).
  const contadorFinal = new Map<string, number>()
  for (const r of resultados) {
    if (r.doctoInternoErp && (r.nivel === 'exacta' || r.nivel === 'equivalente')) {
      contadorFinal.set(r.doctoInternoErp, (contadorFinal.get(r.doctoInternoErp) ?? 0) + 1)
    }
  }
  for (const r of resultados) {
    if (r.doctoInternoErp && (contadorFinal.get(r.doctoInternoErp) ?? 0) > 1) {
      r.duplicadoEnErp = true
    }
  }

  const resumen: ResumenProcesamiento = {
    totalInvoicing: invoicing.length,
    totalRechazadas: rechazadas.length,
    causadas: resultados.filter(r => r.estado === 'CAUSADA').length,
    noCausadas: resultados.filter(r => r.estado === 'NO_CAUSADA').length,
    requierenRevision: resultados.filter(r => r.estado === 'REQUIERE_REVISION').length,
    coincidenciasExactas: resultados.filter(r => r.nivel === 'exacta').length,
    coincidenciasNormalizacion: resultados.filter(r => r.nivel === 'equivalente').length,
    coincidenciasProbables: resultados.filter(r => r.nivel === 'probable').length,
    posiblesDocumentoInterno: resultados.filter(r => r.nivel === 'documento_interno').length,
    duplicados: resultados.filter(r => r.duplicadoEnErp).length,
  }

  return { resultados, resumen, rechazadas }
}
