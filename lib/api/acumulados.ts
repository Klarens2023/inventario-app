import type { Modo, Row, Totales } from '@/types/acumulados'

export async function getAcumulados(params: { desde: string; hasta: string; modo: Modo }): Promise<{
  rows: Row[]; totales: Totales | null; error?: string; ok: boolean
}> {
  const qs = new URLSearchParams()
  if (params.desde) qs.set('desde', params.desde)
  if (params.hasta) qs.set('hasta', params.hasta)
  qs.set('modo', params.modo)
  const res  = await fetch(`/api/acumulados?${qs}`)
  const data = await res.json()
  return { rows: data.rows ?? [], totales: data.totales ?? null, error: data.error, ok: res.ok }
}

export async function reiniciarHistorial() {
  return fetch('/api/reiniciar', { method: 'DELETE' })
}
