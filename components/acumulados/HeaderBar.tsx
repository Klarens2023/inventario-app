type Props = {
  isAdmin: boolean
  reiniciando: boolean
  confirm: number
  onReiniciar: () => void
  rangoActivo: boolean
}

export function HeaderBar({ isAdmin, reiniciando, confirm, onReiniciar, rangoActivo }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Informe Acumulados</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Matriz de diferencias por referencia y fecha</p>
      </div>
      {isAdmin && (
        <button onClick={onReiniciar} disabled={reiniciando} className="btn btn-danger" style={{ fontSize: 12 }}>
          {confirm === 1
            ? (rangoActivo ? 'CONFIRMAR BORRADO DEL RANGO' : 'CONFIRMAR BORRADO TOTAL')
            : (rangoActivo ? 'Reiniciar rango filtrado' : 'Reiniciar historial')}
        </button>
      )}
    </div>
  )
}
