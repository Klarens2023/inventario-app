import type { Modo, Row } from '@/types/consulta'

export async function getFechas(modo: Modo): Promise<string[]> {
  const r = await fetch(`/api/inventario?modo=${modo}`)
  const data: { fecha: string }[] = await r.json()
  return data.map(d => String(d.fecha).substring(0, 10))
}

export async function getInventario(fecha: string, modo: Modo): Promise<Row[]> {
  const r = await fetch(`/api/inventario?fecha=${fecha}&modo=${modo}`)
  const data: { rows: Row[] } = await r.json()
  return data.rows
}

export async function putConteo(id_inventario: number, conteo_fisico: number | null, observaciones: string | null) {
  return fetch('/api/conteo', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_inventario, conteo_fisico, observaciones }),
  })
}

export async function postAcumulaciones(ids: number[], fecha: string) {
  return fetch('/api/acumulaciones', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, fecha }),
  })
}
