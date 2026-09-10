'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FiLogIn, FiEye, FiEyeOff, FiShield } from 'react-icons/fi'
import { useAuthStore } from '@/lib/auth-store'
import { setAccessToken } from '@/lib/admin-api'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'login' | '2fa'>('login')
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Try new marketplace admin auth first
      const mpRes = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const mpData = await mpRes.json()

      if (mpRes.ok && mpData.requires2fa) {
        setTempToken(mpData.tempToken)
        setStep('2fa')
        setIsLoading(false)
        return
      }

      if (mpRes.ok && mpData.accessToken) {
        setAccessToken(mpData.accessToken)
        useAuthStore.getState().setAdminUser({
          id: mpData.user.id,
          email: mpData.user.email,
          role: mpData.user.role,
          firstName: mpData.user.firstName,
          lastName: mpData.user.lastName,
          assignedCountries: mpData.user.assignedCountries || [],
          authType: 'adminUser',
        })
        toast.success('Login successful!')
        window.location.href = '/admin/dashboard'
        return
      }

      // Fallback to website admin auth
      const webRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const webData = await webRes.json()

      if (!webRes.ok) {
        toast.error(webData.error || 'Invalid credentials')
        setIsLoading(false)
        return
      }

      if (webData.success && webData.user) {
        useAuthStore.getState().setAdminUser({
          id: webData.user.id,
          email: webData.user.email,
          role: webData.user.role,
          firstName: webData.user.name?.split(' ')[0] || '',
          lastName: webData.user.name?.split(' ').slice(1).join('') || '',
          assignedCountries: [],
          authType: webData.user.authType,
        })
        toast.success('Login successful!')
        window.location.href = webData.user.authType === 'adminUser'
          ? '/admin/marketplace/dashboard'
          : '/admin/dashboard'
      }
    } catch {
      toast.error('Something went wrong')
      setIsLoading(false)
    }
  }

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpCode }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Verification failed')
        setIsLoading(false)
        return
      }

      setAccessToken(data.accessToken)
      useAuthStore.getState().setAdminUser({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        assignedCountries: data.user.assignedCountries || [],
        authType: 'adminUser',
      })
      toast.success('Login successful!')
      window.location.href = '/admin/dashboard'
    } catch {
      toast.error('Something went wrong')
      setIsLoading(false)
    }
  }

  if (step === '2fa') {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-4">
              <Image src="/logo.JPEG" alt="Maintainex" width={48} height={48} className="object-contain" />
              <span className="text-2xl font-bold text-dark-900">
                Main<span className="text-primary-600">tainex</span>
              </span>
            </Link>
            <h1 className="text-3xl font-bold text-dark-900">Two-Factor Authentication</h1>
            <p className="text-dark-900/70 mt-2">Enter the code from your authenticator app</p>
          </div>

          <form onSubmit={handle2fa} className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
            <div className="text-center">
              <FiShield className="mx-auto text-4xl text-primary-600 mb-4" />
              <label className="block text-gray-700 font-medium mb-2">Authentication Code</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="w-full btn-primary flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiShield className="mr-2" />
                  Verify & Sign In
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setStep('login'); setTotpCode('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-4">
            <Image src="/logo.JPEG" alt="Maintainex" width={48} height={48} className="object-contain" />
            <span className="text-2xl font-bold text-dark-900">
              Main<span className="text-primary-600">tainex</span>
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-dark-900">Admin Login</h1>
          <p className="text-dark-900/70 mt-2">Sign in to access the dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          <div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@maintainex.lk"
                required
              />
            </div>

            <div className="mt-4">
              <label className="block text-gray-700 font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary mt-6 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiLogIn className="mr-2" />
                  Sign In
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
