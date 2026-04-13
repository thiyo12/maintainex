import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
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

const baseAuthOptions: NextAuthOptions = {
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
        } as any
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
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.branchId = (user as any).branchId
        token.isActive = (user as any).isActive
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

export const authOptions = {
  ...baseAuthOptions,
  trustHost: true,
} as NextAuthOptions

export function isSuperAdmin(session: any): boolean {
  return session?.user?.role === 'SUPER_ADMIN'
}

export function isAdminOfBranch(session: any, branchId: string): boolean {
  return session?.user?.branchId === branchId
}
