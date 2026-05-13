'use client'
import { useState, useRef } from 'react'

type Modo = 'items' | 'lotes'

export default function CargarPage() {
  const [dia,     setDia]     = useState('')
  const [file,    setFile]    = useState<File | null>(null)
  const [modo,    setModo]    = useState<Modo>('items')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f) {
      const match = f.name.match(/inv(\d{1,2})/i)
      if (match) setDia(match[1])
      // Detectar automáticamente si el archivo es de lotes por el nombre
      if (f.name.toLowerCase().includes('lot')) setModo('lotes')
    }
    setResult(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !dia) return
    setLoading(true); setResult(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('dia', dia)
    fd.append('modo', modo)

    const res  = await fetch('/api/inventario', { method: 'POST', body: fd })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setResult({ ok: true, msg: `Carga exitosa (${modo}): ${data.insertados} registros guardados para el ${data.fecha}` })
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } else {
      setResult({ ok: false, msg: data.error ?? 'Error desconocido' })
    }
  }

  const hoy = new Date()
  const fechaPrev = dia
    ? new Date(hoy.getFullYear(), hoy.getMonth(), parseInt(dia)).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—'

  const modoStyle = (m: Modo): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 6,
    border: `2px solid ${modo === m ? '#0047BA' : 'var(--border)'}`,
    background: modo === m ? '#0047BA' : 'transparent',
    color: modo === m ? '#fff' : 'var(--text)',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s'
  })

  return (
    <div style={{ padding: '32px 40px', maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>📂 Cargar Inventario</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 28 }}>
        Selecciona el archivo <code style={{ background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>inv[XX].txt</code> exportado del sistema.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Selector de modo */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
              Tipo de inventario
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setModo('items')} style={modoStyle('items')}>
                📦 Por Items
              </button>
              <button type="button" onClick={() => setModo('lotes')} style={modoStyle('lotes')}>
                🏷️ Por Lotes
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
              {modo === 'lotes'
                ? 'El archivo debe tener columna Lote. Se detecta automáticamente si el nombre contiene "lot".'
                : 'Inventario estándar por referencia.'}
            </p>
          </div>

          {/* Dropzone */}
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${file ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, padding: '32px 20px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
              background: file ? 'rgba(63,185,80,0.05)' : 'transparent'
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{file ? '✅' : '📁'}</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              {file ? file.name : 'Haz clic para seleccionar archivo'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Formatos: .txt'}
            </div>
            <input ref={inputRef} type="file" accept=".txt" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>

          {/* Día */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
              Día del inventario
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number" min={1} max={31} value={dia}
                onChange={e => setDia(e.target.value)}
                placeholder="Ej: 22" required
                style={{ width: 100, padding: '10px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                Fecha: <strong style={{ color: 'var(--text)' }}>{fechaPrev}</strong>
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
              Se detecta automáticamente del nombre del archivo. Puedes corregirlo si es necesario.
            </p>
          </div>

          {result && (
            <div style={{
              padding: '12px 16px', borderRadius: 6,
              background: result.ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
              border: `1px solid ${result.ok ? 'var(--accent)' : 'var(--danger)'}`,
              color: result.ok ? 'var(--accent)' : 'var(--danger)', fontSize: 13
            }}>
              {result.msg}
            </div>
          )}

          <button type="submit" disabled={loading || !file || !dia} className="btn btn-primary"
            style={{ alignSelf: 'flex-start', opacity: (!file || !dia) ? 0.5 : 1 }}>
            {loading ? '⏳ Cargando...' : '⬆️ Cargar inventario'}
          </button>
        </form>
      </div>
    </div>
  )
}
