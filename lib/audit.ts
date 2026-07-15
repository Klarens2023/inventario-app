import { sql } from './db'

export async function logAudit(params: {
  usuarioId: string | null
  usuarioNombre: string
  accion: 'CARGA_INVENTARIO' | 'CONTEO_ACTUALIZADO' | 'CONTEO_ACUMULADO' | 'HISTORIAL_REINICIADO' | 'USUARIO_CREADO' | 'USUARIO_MODIFICADO' | 'EQUIPO_CREADO' | 'EQUIPO_ACTUALIZADO' | 'EQUIPO_ELIMINADO' | 'PVN_REGISTRO_CREADO' | 'PVN_PAGO_QR_REGISTRADO' | 'PVN_PAGO_QR_EDITADO' | 'PVN_PAGO_QR_ELIMINADO' | 'PVN_QR_CIERRE_DIA' | 'PVN_TURNO_ABIERTO' | 'PVN_TURNO_CERRADO' | 'TIC_MOVIMIENTO_CREADO' | 'TIC_MOVIMIENTO_ESTADO' | 'AREA_CREADA' | 'AREA_MODIFICADA' | 'AREA_ELIMINADA'
  descripcion: string
  datos?: Record<string, unknown>
}) {
  try {
    await sql`
      INSERT INTO audit_logs (usuario_id, usuario_nombre, accion, descripcion, datos)
      VALUES (
        ${params.usuarioId ? parseInt(params.usuarioId) : null},
        ${params.usuarioNombre},
        ${params.accion},
        ${params.descripcion},
        ${params.datos ? JSON.stringify(params.datos) : null}
      )
    `
  } catch {
    // No interrumpir el flujo principal si falla el log
  }
}
