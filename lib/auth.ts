import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { sql } from './db'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 horas
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
          SELECT id, username, password_hash, nombre, rol, area, debe_cambiar_password
          FROM usuarios
          WHERE username = ${credentials.username}
            AND activo = true
          LIMIT 1
        `

        if (rows.length === 0) return null

        const user = rows[0]
        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        const rol = user.rol ?? 'usuario'
        return {
          id: String(user.id),
          name: user.nombre,
          email: user.username,
          rol,
          area: user.area ?? (rol === 'admin' ? 'general' : 'logistica'),
          debe_cambiar_password: user.debe_cambiar_password ?? false,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { id: string; name?: string; rol?: string; area?: string; debe_cambiar_password?: boolean }
        token.id                    = u.id
        token.name                  = u.name
        token.rol                   = u.rol ?? 'usuario'
        token.area                  = u.area ?? (u.rol === 'admin' ? 'general' : 'logistica')
        token.debe_cambiar_password = u.debe_cambiar_password ?? false
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
      }
      return session
    },
  },
}
