import NextAuth, { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export type UserRole = 'SUPER_ADMIN' | 'ADMIN'

export interface ExtendedUser {
  id: string
  email: string
  name: string | null
  role: string
  branchId: string | null
  isActive: boolean
}

const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email }
        })

        if (!admin) {
          throw new Error('Invalid credentials')
        }

        if (!admin.isActive) {
          throw new Error('Account is deactivated')
        }

        const isValid = await bcrypt.compare(credentials.password, admin.password)

        if (!isValid) {
          throw new Error('Invalid credentials')
        }

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          branchId: admin.branchId,
          isActive: admin.isActive
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60
  },
  pages: {
    signIn: '/coconut/login',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.branchId = user.branchId
        token.isActive = user.isActive
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.branchId = token.branchId
        session.user.isActive = token.isActive
      }
      return session
    }
  }
}

const handler = NextAuth(authOptions as any)

export { handler as GET, handler as POST }
