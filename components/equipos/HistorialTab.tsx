'use client'
import React from 'react'
import type { HistReg } from '@/types/equipos'
import { fmtFecha } from './shared'

type Props = {
  titulo: string
  tipo: 'mantenimientos' | 'incidencias' | 'cambios'
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
