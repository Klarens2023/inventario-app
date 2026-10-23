import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno')
}

// Cliente de Neon por HTTP (sin pool de conexiones: cada consulta es una
// petición, lo que encaja con funciones serverless de Vercel).
// Se usa siempre como plantilla etiquetada: sql`... WHERE id = ${id}`.
// Los valores interpolados viajan como PARÁMETROS, nunca pegados al texto del
// SQL, y eso es lo que evita la inyección SQL. No usar sql(textoArmado) con
// datos del usuario.
export const sql = neon(process.env.DATABASE_URL)
