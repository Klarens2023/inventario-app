/**
 * Reintenta una alta cuando choca por clave duplicada (código 23505 de PostgreSQL).
 *
 * Los consecutivos KL-, TIC-, REP- y el id de productos PVN se calculan como
 * "último + 1" leyendo la tabla; dos altas simultáneas obtienen el mismo número y
 * la segunda fallaba con un 500 (AUD-21). Aquí se vuelve a calcular el número y
 * se reintenta. `fn` debe generar el id en cada llamada y hacer el INSERT.
 *
 * @param fn alta completa (calcular id + insertar); se llama de nuevo en cada intento
 * @param intentos máximo de intentos (por defecto 3)
 * @throws el último error si no es de duplicado o se agotan los intentos
 */
export async function conReintentoPorDuplicado<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (e) {
      if ((e as { code?: string })?.code !== '23505' || i >= intentos) throw e
    }
  }
}
