export function fmtMoneda(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v))
}
export function fmtHora(s: string) {
  return new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
export function fmtFecha(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

export async function comprimirImagen(file: File, maxDim = 1600, calidad = 0.8): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > maxDim || height > maxDim) {
      const escala = maxDim / Math.max(width, height)
      width = Math.round(width * escala)
      height = Math.round(height * escala)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', calidad))
    if (!blob) return file
    return new File([blob], (file.name?.replace(/\.\w+$/, '') || 'comprobante') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}
