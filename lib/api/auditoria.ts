import type { AuditRow, Usuario } from '@/types/auditoria'

export async function getAuditoria(params: {
  desde: string; hasta: string; accion: string; usuarioId: string
}): Promise<{ rows: AuditRow[]; usuarios: Usuario[] }> {
  const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta })
  if (params.accion !== 'todas') qs.set('accion', params.accion)
  if (params.usuarioId) qs.set('usuario_id', params.usuarioId)
  const res  = await fetch(`/api/auditoria?${qs}`)
  const data = await res.json()
  return { rows: data.rows ?? [], usuarios: data.usuarios ?? [] }
}
