import NextAuth, { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER' | 'TASKER'

export interface ExtendedUser {
  id: string
  email: string
  name: string | null
  role: UserRole
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            adminProfile: { select: { role: true, branchId: true } }
          }
        })

        if (!user) {
          throw new Error('Invalid credentials')
        }

        if (!user.isActive) {
          throw new Error('Account is deactivated')
        }

        if (!user.passwordHash) {
          throw new Error('No password set')
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)

        if (!isValid) {
          throw new Error('Invalid credentials')
        }

        const role = user.role as UserRole

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          branchId: user.adminProfile?.branchId ?? null,
          isActive: user.isActive
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60
  },
  pages: {
    signIn: '/admin/login',
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
