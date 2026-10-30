import { sql } from './db'

/**
 * Registra una acción en la bitácora de auditoría (tabla audit_logs, visible
 * en /auditoria para el admin). Con el rol mínimo de BD (scripts/crear-rol-app.js)
 * la app solo puede agregar y leer esta tabla, no modificarla ni borrarla.
 */
export async function logAudit(params: {
  usuarioId: string | null
  usuarioNombre: string
  accion: 'CARGA_INVENTARIO' | 'CONTEO_ACTUALIZADO' | 'CONTEO_ACUMULADO' | 'HISTORIAL_REINICIADO' | 'USUARIO_CREADO' | 'USUARIO_MODIFICADO' | 'EQUIPO_CREADO' | 'EQUIPO_ACTUALIZADO' | 'EQUIPO_ELIMINADO' | 'PVN_REGISTRO_CREADO' | 'PVN_PAGO_QR_REGISTRADO' | 'PVN_PAGO_QR_EDITADO' | 'PVN_PAGO_QR_ELIMINADO' | 'PVN_QR_CIERRE_DIA' | 'PVN_TURNO_ABIERTO' | 'PVN_TURNO_CERRADO' | 'TIC_MOVIMIENTO_CREADO' | 'TIC_MOVIMIENTO_ESTADO' | 'TIC_MOVIMIENTO_FOTO_SUBIDA' | 'AREA_CREADA' | 'AREA_MODIFICADA' | 'AREA_ELIMINADA' | 'MANTENIMIENTO_REALIZADO' | 'MANTENIMIENTO_NO_REALIZADO' | 'TIC_ARTICULO_CREADO' | 'TIC_ARTICULO_ACTUALIZADO' | 'TIC_ARTICULO_MOVIMIENTO' | 'LOGIN_EXITOSO' | 'LOGIN_FALLIDO' | 'LOGIN_BLOQUEADO' | 'DOS_PASOS_ACTIVADO' | 'DOS_PASOS_REINICIADO' | 'DOS_PASOS_CODIGOS_REGENERADOS' | 'FOTOS_DEPURADAS'
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
  } catch (e) {
    // No se interrumpe la operación del usuario si falla la bitácora, pero
    // queda constancia en los logs del servidor (Vercel) para revisarlo.
    console.error('[auditoria] No se pudo registrar', params.accion, e)
  }
}

/**
 * Registra un inicio de sesión (web o app móvil) en la bitácora.
 *
 * Solo se llama para usuarios que EXISTEN: los intentos con usuarios
 * inexistentes no se guardan (los cuenta el límite por IP en
 * login_intentos_ip), así un ataque automático no llena la bitácora y no
 * se guarda lo que alguien escriba por error en el campo de usuario (a
 * veces es su contraseña). Los fallos de una cuenta están acotados: a los 5
 * seguidos se bloquea y los intentos durante el bloqueo no llegan aquí.
 */
export async function registrarInicioSesion(params: {
  resultado: 'exitoso' | 'fallido' | 'bloqueado'
  usuarioId: number
  username: string
  canal: 'web' | 'movil'
  ip: string
  navegador: string | null | undefined
  motivo?: string
}) {
  const acciones = { exitoso: 'LOGIN_EXITOSO', fallido: 'LOGIN_FALLIDO', bloqueado: 'LOGIN_BLOQUEADO' } as const
  const textos = {
    exitoso: 'Inició sesión',
    fallido: 'Intento de inicio de sesión fallido',
    bloqueado: 'Cuenta bloqueada por intentos fallidos',
  }
  await logAudit({
    usuarioId: String(params.usuarioId),
    usuarioNombre: params.username,
    accion: acciones[params.resultado],
    descripcion: `${textos[params.resultado]} (${params.canal === 'web' ? 'web' : 'app móvil'})${params.motivo ? ': ' + params.motivo : ''}`,
    // El navegador se recorta: es solo para reconocer el equipo, no para rastrear
    datos: { canal: params.canal, ip: params.ip, navegador: (params.navegador ?? '').slice(0, 150) },
  })
}
