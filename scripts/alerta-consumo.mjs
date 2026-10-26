#!/usr/bin/env node
/**
 * Alerta de consumo de Neon (plan Free). La corre .github/workflows/alerta-consumo.yml
 * cada mañana. Si algún recurso del mes pasa del porcentaje configurado del
 * límite del plan, termina con error: GitHub Actions envía un correo y el
 * resumen de la ejecución muestra la tabla.
 *
 * Por qué importa: en el plan Free, al pasar el límite Neon SUSPENDE la base
 * hasta el mes siguiente y la app deja de funcionar.
 *
 * Variables de entorno:
 *   NEON_API_KEY        clave de API de Neon (secreto de GitHub)
 *   NEON_PROJECT_ID     id del proyecto (quiet-meadow-57860269)
 *   ALERTA_PORCENTAJE   umbral de aviso (por defecto 50)
 *   LIMITE_CU_HORAS     límite de cómputo del plan por mes (por defecto 100)
 *   LIMITE_TRANSFER_GB  límite de transferencia por mes (por defecto 5)
 *
 * Sin dependencias (fetch de Node 22). No imprime secretos.
 */
import { appendFileSync } from 'node:fs'

const API = 'https://console.neon.tech/api/v2'
const clave = process.env.NEON_API_KEY
const proyecto = process.env.NEON_PROJECT_ID
const umbral = Number(process.env.ALERTA_PORCENTAJE ?? 50)
const limiteCuH = Number(process.env.LIMITE_CU_HORAS ?? 100)
const limiteTransferGb = Number(process.env.LIMITE_TRANSFER_GB ?? 5)

if (!clave || !proyecto) {
  console.error('Faltan NEON_API_KEY o NEON_PROJECT_ID')
  process.exit(1)
}

async function leer(ruta) {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${clave}`, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`Neon respondió ${r.status} en ${ruta}`)
  return r.json()
}

const { project: p } = await leer(`/projects/${proyecto}`)
const { branches } = await leer(`/projects/${proyecto}/branches`)

// Qué tan avanzado va el mes de facturación (para proyectar al cierre)
const inicio = new Date(p.consumption_period_start).getTime()
const fin = new Date(p.consumption_period_end).getTime()
const avance = Math.min(1, Math.max(0.01, (Date.now() - inicio) / (fin - inicio)))

const GB = 1024 ** 3
// Almacenamiento: el límite del plan es por rama; se vigila la más grande
const mayorRama = Math.max(...branches.map(b => b.logical_size ?? 0))
const limiteRama = p.branch_logical_size_limit_bytes ?? GB

const recursos = [
  { nombre: 'Cómputo (CU-h)', uso: p.compute_time_seconds / 3600, limite: limiteCuH, acumulativo: true, fmt: v => v.toFixed(1) },
  { nombre: 'Transferencia (GB)', uso: p.data_transfer_bytes / GB, limite: limiteTransferGb, acumulativo: true, fmt: v => v.toFixed(2) },
  { nombre: 'Almacenamiento rama mayor (GB)', uso: mayorRama / GB, limite: limiteRama / GB, acumulativo: false, fmt: v => v.toFixed(3) },
]

let alertas = 0
const filas = recursos.map(r => {
  const pct = (r.uso / r.limite) * 100
  // Proyección al cierre del mes, solo para lo que se acumula (el almacenamiento no)
  const proyeccion = r.acumulativo ? (pct / avance) : pct
  const alerta = pct >= umbral
  if (alerta) alertas++
  return `| ${r.nombre} | ${r.fmt(r.uso)} | ${r.fmt(r.limite)} | ${pct.toFixed(0)}% | ${proyeccion.toFixed(0)}% | ${alerta ? '⚠️ supera ' + umbral + '%' : 'ok'} |`
})

const resumen = [
  `### Consumo de Neon (proyecto ${p.name}) — mes ${p.consumption_period_start.slice(0, 10)} a ${p.consumption_period_end.slice(0, 10)}, ${(avance * 100).toFixed(0)}% transcurrido`,
  '',
  '| Recurso | Uso | Límite | % del límite | Proyección al cierre | Estado |',
  '|---|---|---|---|---|---|',
  ...filas,
  '',
  alertas
    ? `**${alertas} recurso(s) superan el ${umbral}% del límite.** Si se llega al 100%, Neon suspende la base hasta el mes siguiente. Opciones: complemento de USD 10/mes (250 CU-h) o plan Launch.`
    : `Todo por debajo del ${umbral}%.`,
].join('\n')

console.log(resumen)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumen + '\n')
if (alertas) process.exit(1)
