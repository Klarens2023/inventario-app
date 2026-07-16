export type AuditRow = {
  id: number
  usuario_nombre: string
  username: string
  accion: string
  descripcion: string
  datos: Record<string, unknown> | null
  created_at: string
}

export type Usuario = { id: number; nombre: string; username: string }
