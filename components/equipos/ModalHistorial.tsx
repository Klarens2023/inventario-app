'use client'
import React from 'react'
import { MI } from './shared'

type ModalTipo = 'mantenimiento' | 'incidencia' | 'cambio'

type Props = {
  tipo: ModalTipo
  data: Record<string, string>
  guardando: boolean
  onClose: () => void
  onChange: (d: Record<string, string>) => void
  onGuardar: () => void
}

export function ModalHistorial({ tipo, data, guardando, onClose, onChange, onGuardar }: Props) {
  const titulo = tipo === 'mantenimiento' ? 'Nuevo Mantenimiento' : tipo === 'incidencia' ? 'Nueva Incidencia' : 'Cambio de Componente'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 520, width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{titulo}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tipo === 'mantenimiento' && <>
            <MI label="Fecha *"                k="fecha"          data={data} setData={onChange} type="date" />
            <MI label="Tipo de Mantenimiento"  k="tipo_mant"      data={data} setData={onChange} placeholder="Ej: Preventivo, Correctivo" />
            <MI label="Descripción"            k="descripcion"    data={data} setData={onChange} placeholder="Qué se realizó..." />
            <MI label="Técnico"                k="tecnico"        data={data} setData={onChange} />
            <MI label="Empresa"                k="empresa"        data={data} setData={onChange} />
            <MI label="Costo ($)"              k="costo"          data={data} setData={onChange} type="number" />
            <MI label="Próxima Fecha"          k="proxima_fecha"  data={data} setData={onChange} type="date" />
            <MI label="Observaciones"          k="observaciones"  data={data} setData={onChange} />
          </>}
          {tipo === 'incidencia' && <>
            <MI label="Ticket / ID"            k="ticket_id"      data={data} setData={onChange} placeholder="Ej: TK-2024-001" />
            <MI label="Fecha Apertura *"       k="fecha_apertura" data={data} setData={onChange} type="date" />
            <MI label="Tipo"                   k="tipo_inc"       data={data} setData={onChange} placeholder="Ej: Hardware, Software, Red" />
            <MI label="Descripción"            k="descripcion"    data={data} setData={onChange} placeholder="Qué ocurrió..." />
            <MI label="Prioridad"              k="prioridad"      data={data} setData={onChange} placeholder="Alta, Media, Baja" />
            <MI label="Técnico Asignado"       k="tecnico"        data={data} setData={onChange} />
            <MI label="Solución"               k="solucion"       data={data} setData={onChange} />
            <MI label="Fecha Cierre"           k="fecha_cierre"   data={data} setData={onChange} type="date" />
            <MI label="Estado"                 k="estado_ticket"  data={data} setData={onChange} placeholder="Abierto, En proceso, Cerrado" />
          </>}
          {tipo === 'cambio' && <>
            <MI label="Fecha *"                k="fecha"                data={data} setData={onChange} type="date" />
            <MI label="Componente"             k="componente"           data={data} setData={onChange} placeholder="Ej: RAM, Disco, Procesador" />
            <MI label="Descripción Anterior"   k="descripcion_anterior" data={data} setData={onChange} placeholder="Qué tenía antes..." />
            <MI label="Descripción Nuevo"      k="descripcion_nuevo"    data={data} setData={onChange} placeholder="Qué se instaló..." />
            <MI label="Motivo"                 k="motivo"               data={data} setData={onChange} placeholder="Ej: Falla, Upgrade, Reemplazo" />
            <MI label="Técnico"                k="tecnico"              data={data} setData={onChange} />
            <MI label="Observaciones"          k="observaciones"        data={data} setData={onChange} />
          </>}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onGuardar} disabled={guardando} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
            {guardando ? 'Guardando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}
