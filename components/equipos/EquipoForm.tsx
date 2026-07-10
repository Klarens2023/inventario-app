'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { crearEquipo } from '@/lib/api/equipos'
import { TIPOS_EQUIPO, TIPOS_PC, TIPOS_MONITOR, TIPOS_IMPRESORA, TIPOS_SOFTWARE, CAMPOS_INICIAL } from './constants'
import { Seccion, Campo, grid3, selectStyle, inputStyle } from './shared'

export function EquipoForm() {
  const router = useRouter()
  const [campos, setCampos] = useState(CAMPOS_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const tipo        = campos.tipo_equipo as string
  const esPC        = TIPOS_PC.includes(tipo)
  const esMonitor   = TIPOS_MONITOR.includes(tipo)
  const esImpresora = TIPOS_IMPRESORA.includes(tipo)
  const esSoftware  = TIPOS_SOFTWARE.includes(tipo)

  function set(k: string, v: string | boolean) {
    setCampos(prev => ({ ...prev, [k]: v }))
  }

  async function guardar() {
    setError('')
    if (!campos.tipo_equipo || !campos.marca) { setError('Tipo de equipo y marca son obligatorios'); return }
    setGuardando(true)
    try {
      const data = await crearEquipo(campos)
      if (data.error) { setError(data.error); return }
      router.push(`/sistemas/equipos/${data.id}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ padding: '32px 28px', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <Link href="/sistemas/equipos" style={{ color: 'var(--text2)', textDecoration: 'none', fontSize: 14 }}>← Volver al Inventario</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Registrar Nuevo Equipo</h1>
        </div>
        <button onClick={guardar} disabled={guardando}
          style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
          {guardando ? 'Guardando...' : 'Guardar Equipo'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#991b1b', fontWeight: 600 }}>{error}</div>
      )}

      <Seccion titulo="1. Identificación" color="#0047BA">
        <div style={grid3}>
          <Campo label="ID" value="Se generará automáticamente" disabled />
          <Campo label="Tipo de Equipo *" required>
            <select value={tipo} onChange={e => set('tipo_equipo', e.target.value)} style={selectStyle}>
              <option value="">Seleccionar...</option>
              {TIPOS_EQUIPO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Marca *" value={campos.marca as string} onChange={v => set('marca', v)} placeholder="Ej: HP, Dell, Lenovo" />
        </div>
        <div style={grid3}>
          <Campo label="Modelo"    value={campos.modelo as string}       onChange={v => set('modelo', v)}       placeholder="Ej: ProBook 450 G8" />
          <Campo label="N° Serie"  value={campos.numero_serie as string} onChange={v => set('numero_serie', v)} placeholder="Ej: MXL0483R2K" />
          <Campo label="N° Interno" value={campos.numero_interno as string} onChange={v => set('numero_interno', v)} />
        </div>
        <div style={grid3}>
          <Campo label="Placa Activo Fijo" value={campos.placa_activo as string} onChange={v => set('placa_activo', v)} placeholder="Opcional" />
          <Campo label="Cód. Barras / QR"  value={campos.cod_barras as string}   onChange={v => set('cod_barras', v)} />
        </div>
      </Seccion>

      {esPC && (
        <Seccion titulo="2. Hardware" color="#1e40af">
          <div style={grid3}>
            <Campo label="Procesador" value={campos.procesador as string} onChange={v => set('procesador', v)} placeholder="Ej: Intel Core i7-11th" />
            <Campo label="Núcleos"    value={campos.nucleos_procesador as string} onChange={v => set('nucleos_procesador', v)} placeholder="Ej: 8 núcleos" />
            <Campo label="Velocidad"  value={campos.velocidad_procesador as string} onChange={v => set('velocidad_procesador', v)} placeholder="Ej: 2.8 GHz" />
          </div>
          <div style={grid3}>
            <Campo label="RAM Capacidad" value={campos.ram_capacidad as string} onChange={v => set('ram_capacidad', v)} placeholder="Ej: 16 GB" />
            <Campo label="RAM Tipo"      value={campos.ram_tipo as string}      onChange={v => set('ram_tipo', v)}      placeholder="Ej: DDR4" />
            <Campo label="Disco Tipo"    value={campos.disco_tipo as string}    onChange={v => set('disco_tipo', v)}    placeholder="Ej: SSD NVMe" />
          </div>
          <div style={grid3}>
            <Campo label="Disco Capacidad"  value={campos.disco_capacidad as string}  onChange={v => set('disco_capacidad', v)}  placeholder="Ej: 512 GB" />
            <Campo label="Disco Secundario" value={campos.disco_secundario as string} onChange={v => set('disco_secundario', v)} placeholder="Ej: HDD 1 TB" />
            <Campo label="Unidad Óptica"    value={campos.unidad_optica as string}    onChange={v => set('unidad_optica', v)}    placeholder="Ej: DVD-RW" />
          </div>
          <div style={grid3}>
            <Campo label="Tarjeta de Video" value={campos.tarjeta_video as string} onChange={v => set('tarjeta_video', v)} placeholder="Ej: NVIDIA RTX 3060" />
            <Campo label="Fuente de Poder"  value={campos.fuente_poder as string}  onChange={v => set('fuente_poder', v)}  placeholder="Ej: 650W" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
              <input type="checkbox" id="camara" checked={campos.camara_integrada as boolean} onChange={e => set('camara_integrada', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="camara" style={{ fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>Tiene cámara integrada</label>
            </div>
          </div>
        </Seccion>
      )}

      {esMonitor && (
        <Seccion titulo="2. Especificaciones Monitor/Pantalla" color="#1e40af">
          <div style={grid3}>
            <Campo label="Marca Monitor"  value={campos.monitor_marca as string}  onChange={v => set('monitor_marca', v)} />
            <Campo label="Modelo Monitor" value={campos.monitor_modelo as string} onChange={v => set('monitor_modelo', v)} />
            <Campo label="Serial Monitor" value={campos.monitor_serial as string} onChange={v => set('monitor_serial', v)} />
          </div>
          <div style={grid3}>
            <Campo label="Pulgadas"     value={campos.monitor_pulgadas as string}    onChange={v => set('monitor_pulgadas', v)}    placeholder='Ej: 24"' />
            <Campo label="Resolución"   value={campos.monitor_resolucion as string}  onChange={v => set('monitor_resolucion', v)}  placeholder="Ej: 1920x1080" />
            <Campo label="Tipo de Panel" value={campos.monitor_tipo_panel as string} onChange={v => set('monitor_tipo_panel', v)} placeholder="Ej: IPS, VA, TN" />
          </div>
        </Seccion>
      )}

      {esImpresora && (
        <Seccion titulo="2. Impresora / Consumibles" color="#1e40af">
          <div style={grid3}>
            <Campo label="Tipo Impresora"     value={campos.impresora_tipo as string}     onChange={v => set('impresora_tipo', v)}     placeholder="Ej: Láser Color" />
            <Campo label="Referencia Tóner"   value={campos.toner_referencia as string}   onChange={v => set('toner_referencia', v)}   placeholder="Ej: HP 508A" />
            <Campo label="Rendimiento Tóner"  value={campos.toner_rendimiento as string}  onChange={v => set('toner_rendimiento', v)}  placeholder="Ej: 6.000 páginas" />
          </div>
          <div style={grid3}>
            <Campo label="Último Cambio Tóner"  type="date" value={campos.toner_ultimo_cambio as string}  onChange={v => set('toner_ultimo_cambio', v)} />
            <Campo label="Próximo Cambio Tóner" type="date" value={campos.toner_proximo_cambio as string} onChange={v => set('toner_proximo_cambio', v)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
              <input type="checkbox" id="en_red" checked={campos.impresora_en_red as boolean} onChange={e => set('impresora_en_red', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="en_red" style={{ fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>Conectada en red</label>
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo={esPC || esMonitor || esImpresora ? '3. Red' : '2. Red'} color="#0369a1">
        <div style={grid3}>
          <Campo label="IP Asignada"      value={campos.ip_asignada as string}    onChange={v => set('ip_asignada', v)}    placeholder="Ej: 192.168.1.100" />
          <Campo label="Máscara de Subred" value={campos.mascara_subred as string} onChange={v => set('mascara_subred', v)} placeholder="Ej: 255.255.255.0" />
          <Campo label="Gateway"          value={campos.gateway as string}        onChange={v => set('gateway', v)}        placeholder="Ej: 192.168.1.1" />
        </div>
        <div style={grid3}>
          <Campo label="DNS Primario"  value={campos.dns_primario as string}  onChange={v => set('dns_primario', v)} />
          <Campo label="MAC Address"   value={campos.mac_address as string}   onChange={v => set('mac_address', v)}   placeholder="Ej: AA:BB:CC:DD:EE:FF" />
          <Campo label="Tipo Conexión" value={campos.tipo_conexion as string} onChange={v => set('tipo_conexion', v)} placeholder="Ej: Ethernet, Wi-Fi" />
        </div>
        <div style={grid3}>
          <Campo label="Hostname" value={campos.hostname as string} onChange={v => set('hostname', v)} placeholder="Ej: PC-VENTAS-01" />
          <Campo label="Dominio"  value={campos.dominio as string}  onChange={v => set('dominio', v)}  placeholder="Ej: klarens.local" />
        </div>
      </Seccion>

      {esSoftware && (
        <Seccion titulo="4. Software" color="#4f46e5">
          <div style={grid3}>
            <Campo label="Sistema Operativo" value={campos.sistema_operativo as string} onChange={v => set('sistema_operativo', v)} placeholder="Ej: Windows 11 Pro" />
            <Campo label="Versión SO"        value={campos.version_so as string}        onChange={v => set('version_so', v)}        placeholder="Ej: 22H2" />
            <Campo label="Licencia SO"       value={campos.licencia_so as string}       onChange={v => set('licencia_so', v)} />
          </div>
          <div style={grid3}>
            <Campo label="Office / Paquete"  value={campos.office_version as string}  onChange={v => set('office_version', v)}  placeholder="Ej: Microsoft 365" />
            <Campo label="Licencia Office"   value={campos.licencia_office as string} onChange={v => set('licencia_office', v)} />
            <Campo label="Antivirus"         value={campos.antivirus as string}       onChange={v => set('antivirus', v)}       placeholder="Ej: Kaspersky Endpoint" />
          </div>
          <div style={grid3}>
            <Campo label="Versión Antivirus"  value={campos.version_antivirus as string}  onChange={v => set('version_antivirus', v)} />
            <Campo label="Licencia Antivirus" value={campos.licencia_antivirus as string} onChange={v => set('licencia_antivirus', v)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5, textTransform: 'uppercase' }}>Software Adicional</label>
            <textarea value={campos.software_adicional as string} onChange={e => set('software_adicional', e.target.value)}
              placeholder="Ej: AutoCAD 2023, Adobe Acrobat..." rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </Seccion>
      )}

      <Seccion titulo="5. Ubicación" color="#047857">
        <div style={grid3}>
          <Campo label="Sede"         value={campos.sede as string}                    onChange={v => set('sede', v)}                    placeholder="Ej: Planta Valledupar" />
          <Campo label="Área / Dpto." value={campos.area_ubicacion as string}          onChange={v => set('area_ubicacion', v)}          placeholder="Ej: Producción" />
          <Campo label="Departamento" value={campos.departamento_ubicacion as string}  onChange={v => set('departamento_ubicacion', v)} />
        </div>
        <div style={grid3}>
          <Campo label="Piso / Oficina"    value={campos.piso_oficina as string}   onChange={v => set('piso_oficina', v)}   placeholder="Ej: Piso 2, Oficina 204" />
          <Campo label="Puesto de Trabajo" value={campos.puesto_trabajo as string} onChange={v => set('puesto_trabajo', v)} />
          <Campo label="Ext. Telefónica"   value={campos.ext_telefonica as string} onChange={v => set('ext_telefonica', v)} />
        </div>
        <div style={grid3}>
          <Campo label="Responsable del Equipo" value={campos.responsable as string}      onChange={v => set('responsable', v)}      placeholder="Nombre del responsable" />
          <Campo label="Cargo del Responsable"  value={campos.cargo_responsable as string} onChange={v => set('cargo_responsable', v)} />
          <Campo label="Usuario Asignado"       value={campos.usuario_asignado as string}  onChange={v => set('usuario_asignado', v)}  placeholder="Nombre del usuario final" />
        </div>
      </Seccion>

      <Seccion titulo="6. Estado y Garantía" color="#b45309">
        <div style={grid3}>
          <Campo label="Estado *" required>
            <select value={campos.estado as string} onChange={e => set('estado', e.target.value)} style={selectStyle}>
              {['Activo','Mantenimiento','Obsoleto','Baja'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          <Campo label="Condición Física"    value={campos.condicion_fisica as string}   onChange={v => set('condicion_fisica', v)}   placeholder="Ej: Buena, Regular, Dañado" />
          <Campo label="Forma de Adquisición" value={campos.forma_adquisicion as string} onChange={v => set('forma_adquisicion', v)} placeholder="Ej: Compra, Donación" />
        </div>
        <div style={grid3}>
          <Campo label="Fecha de Adquisición" type="date"   value={campos.fecha_adquisicion as string}  onChange={v => set('fecha_adquisicion', v)} />
          <Campo label="Valor Adquisición ($)" type="number" value={campos.valor_adquisicion as string} onChange={v => set('valor_adquisicion', v)} />
          <Campo label="Proveedor"            value={campos.proveedor as string}                        onChange={v => set('proveedor', v)} />
        </div>
        <div style={grid3}>
          <Campo label="Tipo de Garantía" value={campos.tipo_garantia as string}       onChange={v => set('tipo_garantia', v)}       placeholder="Ej: 1 año partes y mano de obra" />
          <Campo label="Inicio Garantía"  type="date" value={campos.fecha_inicio_garantia as string} onChange={v => set('fecha_inicio_garantia', v)} />
          <Campo label="Fin Garantía"     type="date" value={campos.fecha_fin_garantia as string}    onChange={v => set('fecha_fin_garantia', v)} />
        </div>
        <div style={grid3}>
          <Campo label="N° Contrato" value={campos.contrato_numero as string} onChange={v => set('contrato_numero', v)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
            <input type="checkbox" id="en_garantia" checked={campos.en_garantia as boolean} onChange={e => set('en_garantia', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="en_garantia" style={{ fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>Actualmente en garantía</label>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="7. Mantenimiento Preventivo" color="#7c3aed">
        <div style={grid3}>
          <Campo label="Tipo de Mantenimiento" value={campos.tipo_mantenimiento as string}       onChange={v => set('tipo_mantenimiento', v)}       placeholder="Ej: Preventivo" />
          <Campo label="Frecuencia"            value={campos.frecuencia_mantenimiento as string} onChange={v => set('frecuencia_mantenimiento', v)} placeholder="Ej: Semestral" />
          <Campo label="Técnico Responsable"   value={campos.tecnico_responsable as string}      onChange={v => set('tecnico_responsable', v)} />
        </div>
        <div style={grid3}>
          <Campo label="Último Mantenimiento"  type="date" value={campos.ultimo_mantenimiento as string}  onChange={v => set('ultimo_mantenimiento', v)} />
          <Campo label="Próximo Mantenimiento" type="date" value={campos.proximo_mantenimiento as string} onChange={v => set('proximo_mantenimiento', v)} />
          <Campo label="Contrato Mantenimiento" value={campos.contrato_mantenimiento as string}           onChange={v => set('contrato_mantenimiento', v)} />
        </div>
      </Seccion>

      <Seccion titulo="8. Observaciones" color="#374151">
        <textarea value={campos.observaciones as string} onChange={e => set('observaciones', e.target.value)}
          placeholder="Notas adicionales..." rows={4}
          style={{ ...inputStyle, resize: 'vertical', width: '100%' }} />
      </Seccion>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8, paddingBottom: 40 }}>
        <Link href="/sistemas/equipos" style={{ padding: '11px 24px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Cancelar</Link>
        <button onClick={guardar} disabled={guardando}
          style={{ padding: '11px 28px', borderRadius: 8, border: 'none', background: '#0047BA', color: '#fff', fontWeight: 700, fontSize: 14, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
          {guardando ? 'Guardando...' : 'Guardar Equipo'}
        </button>
      </div>
    </div>
  )
}
