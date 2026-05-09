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
          SELECT id, username, password_hash, nombre, rol
          FROM usuarios
          WHERE username = ${credentials.username}
            AND activo = true
          LIMIT 1
        `

        if (rows.length === 0) return null

        const user = rows[0]
        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) return null

        return { id: String(user.id), name: user.nombre, email: user.username, rol: user.rol ?? 'usuario' }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id  = user.id
        token.name = user.name
        token.rol = (user as { rol?: string }).rol ?? 'usuario'
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id as string
        session.user.name = token.name as string
        session.user.rol  = token.rol as string
      }
      return session
    },
  },
}
