'use client'
import React from 'react'
import Link from 'next/link'
import type { HistReg } from '@/types/equipos'
import { fmtFecha } from './shared'

type Props = {
  titulo: string
  tipo: 'mantenimientos' | 'incidencias' | 'cambios' | 'movimientos' | 'repuestos'
  rows: HistReg[]
  canAdd: boolean
  onAdd: () => void
}

const CONFIG = {
  mantenimientos: {
    columnas: ['Fecha','Tipo','Descripción','Técnico','Empresa','Costo','Próxima Fecha'],
    getRow: (r: HistReg) => [
      fmtFecha(r.fecha as string), r.tipo as string,
      r.descripcion as string, r.tecnico as string,
      r.empresa as string, r.costo ? `$${Number(r.costo).toLocaleString('es-CO')}` : '',
      fmtFecha(r.proxima_fecha as string),
    ],
  },
  incidencias: {
    columnas: ['Ticket','Apertura','Cierre','Tipo','Descripción','Prioridad','Estado'],
    getRow: (r: HistReg) => [
      r.ticket_id as string, fmtFecha(r.fecha_apertura as string),
      fmtFecha(r.fecha_cierre as string), r.tipo as string,
      r.descripcion as string, r.prioridad as string, r.estado_ticket as string,
    ],
  },
  cambios: {
    columnas: ['Fecha','Componente','Anterior','Nuevo','Motivo','Técnico'],
    getRow: (r: HistReg) => [
      fmtFecha(r.fecha as string), r.componente as string,
      r.descripcion_anterior as string, r.descripcion_nuevo as string,
      r.motivo as string, r.tecnico as string,
    ],
  },
  movimientos: {
    columnas: ['ID','Fecha','Movimiento','Motivo','Origen','Destino','Estado'],
    getRow: (r: HistReg) => [
      <Link key="id" href={`/sistemas/movimientos?ver=${r.id}`} style={{ color: '#0047BA', fontWeight: 700, fontFamily: 'monospace' }}>{r.id as string}</Link>,
      fmtFecha(r.fecha as string), r.tipo_movimiento as string,
      r.motivo as string, r.origen_nombre as string, r.destino_nombre as string, r.estado as string,
    ],
  },
  repuestos: {
    columnas: ['Estado','Desde','Artículo','Cant.','Costo','Usuario','Préstamo hasta','Retiro','Motivo / observación'],
    getRow: (r: HistReg) => {
      const estado = r.vencido ? 'Préstamo vencido' : ESTADO_REPUESTO[r.estado as string] ?? (r.estado as string)
      const color = r.vencido ? '#991b1b' : r.estado === 'vigente' ? '#065f46' : r.estado === 'reemplazado' ? '#5b21b6' : '#475569'
      return [
        <span key="e" style={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}>{estado}</span>,
        fmtFecha(r.fecha as string),
        <span key="a"><span style={{ color: '#0047BA', fontWeight: 700, fontFamily: 'monospace' }}>{r.articulo_codigo as string}</span> {r.descripcion as string}
          {r.reemplaza_a ? <span style={{ display: 'block', fontSize: 11, color: '#5b21b6' }}>Reemplazó la asignación #{r.reemplaza_a as number}</span> : null}</span>,
        String(r.cantidad),
        r.costo != null ? `$${Math.round(Number(r.costo)).toLocaleString('es-CO')}` : '—',
        r.persona_nombre as string,
        r.es_prestamo ? fmtFecha(r.fecha_limite_prestamo as string) : '—',
        r.fecha_retiro
          ? <span key="r">{DESTINO_REPUESTO[r.destino_retiro as string] ?? ''} · {fmtFecha(r.fecha_retiro as string)}
              {r.reemplazada_por ? <span style={{ display: 'block', fontSize: 11, color: '#5b21b6' }}>Reemplazado por #{r.reemplazada_por as number} {r.reemplazada_por_codigo as string}</span> : null}</span>
          : '—',
        [r.motivo_retiro, r.detalle_retiro, r.observaciones].filter(Boolean).join(' — ') || '—',
      ]
    },
  },
}

const ESTADO_REPUESTO: Record<string, string> = {
  vigente: 'Vigente', devuelto: 'Devuelto', reemplazado: 'Reemplazado', consumo: 'Consumo',
}
const DESTINO_REPUESTO: Record<string, string> = {
  inventario: 'Volvió al inventario', baja: 'Dado de baja', garantia: 'En garantía', perdido: 'Perdido',
}

export function HistorialTab({ titulo, tipo, rows, canAdd, onAdd }: Props) {
  const { columnas, getRow } = CONFIG[tipo]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{titulo}</h2>
        {canAdd && (
          <button onClick={onAdd} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Agregar
          </button>
        )}
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="inv-table">
            <thead><tr>{columnas.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={columnas.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text2)' }}>Sin registros</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>{getRow(r).map((cell, j) => <td key={j}>{cell ?? '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
