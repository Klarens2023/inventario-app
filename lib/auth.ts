import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { sql } from './db'
import { minutosRestantesBloqueo, registrarIntentoFallido, resetearIntentosFallidos } from './loginBruteForce'

const SESION_PVN_PVV_SEGUNDOS = 24 * 60 * 60 // 24 horas
const SESION_DEFAULT_SEGUNDOS = 8 * 60 * 60  // 8 horas (admin, lider, usuario)

export const authOptions: NextAuthOptions = {
  // maxAge es el techo (para que la cookie no expire antes que el JWT de
  // pvn/pvv); la duración real por rol se fija abajo en el callback jwt,
  // escribiendo token.exp directamente.
  session: { strategy: 'jwt', maxAge: SESION_PVN_PVV_SEGUNDOS },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const rows = await sql`
          SELECT id, username, password_hash, nombre, rol, area, debe_cambiar_password, punto_venta_id,
                 bloqueado_hasta
          FROM usuarios
          WHERE username = ${credentials.username}
            AND activo = true
          LIMIT 1
        `

        if (rows.length === 0) return null

        const user = rows[0]

        const minutosRestantes = minutosRestantesBloqueo({ bloqueado_hasta: user.bloqueado_hasta })
        if (minutosRestantes > 0) {
          throw new Error(`Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`)
        }

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) {
          await registrarIntentoFallido(user.id)
          return null
        }
        await resetearIntentosFallidos(user.id)

        // try/catch: si la migración de usuario_modulos aún no se ha corrido,
        // no debe romper el login de nadie — simplemente no hay módulos extra.
        let modulos: string[] = []
        try {
          const modulosRows = await sql`SELECT modulo FROM usuario_modulos WHERE usuario_id = ${user.id}`
          modulos = modulosRows.map(r => r.modulo as string)
        } catch {}

        const rol = user.rol ?? 'usuario'
        // Admin siempre va a área 'general', sin importar lo que tenga en BD
        const area = rol === 'admin' ? 'general' : (user.area ?? 'logistica')
        return {
          id: String(user.id),
          name: user.nombre,
          email: user.username,
          rol,
          area,
          debe_cambiar_password: user.debe_cambiar_password ?? false,
          punto_venta_id: user.punto_venta_id ?? null,
          modulos,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { id: string; name?: string; rol?: string; area?: string; debe_cambiar_password?: boolean; punto_venta_id?: number | null; modulos?: string[] }
        token.id                    = u.id
        token.name                  = u.name
        token.rol                   = u.rol ?? 'usuario'
        token.area                  = u.rol === 'admin' ? 'general' : (u.area ?? 'logistica')
        token.debe_cambiar_password = u.debe_cambiar_password ?? false
        token.punto_venta_id        = u.punto_venta_id ?? null
        token.modulos               = u.modulos ?? []

        // Sesión más larga para pvn/pvv (24h) que para el resto (8h); se fija
        // solo al iniciar sesión, no en cada refresco del token.
        const duracion = ['pvn', 'pvv'].includes(token.rol as string)
          ? SESION_PVN_PVV_SEGUNDOS
          : SESION_DEFAULT_SEGUNDOS
        token.exp = Math.floor(Date.now() / 1000) + duracion
      }
      // Permite actualizar el token desde el cliente con useSession().update()
      if (trigger === 'update' && session?.debe_cambiar_password !== undefined) {
        token.debe_cambiar_password = session.debe_cambiar_password
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id                    = token.id as string
        session.user.name                  = token.name as string
        session.user.rol                   = token.rol as string
        session.user.area                  = (token.area as string) ?? (token.rol === 'admin' ? 'general' : 'logistica')
        session.user.debe_cambiar_password = token.debe_cambiar_password as boolean
        session.user.punto_venta_id        = (token.punto_venta_id as number | null) ?? null
        session.user.modulos               = (token.modulos as string[]) ?? []
      }
      return session
    },
  },
}
