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
  const [step, setStep] = useState<'login' | '2fa' | 'enroll'>('login')
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  // First-time super-admin MFA enrollment. These values live only in this
  // component's memory: never written to localStorage/sessionStorage/cookies.
  const [enrollmentToken, setEnrollmentToken] = useState('')
  const [enrollPassword, setEnrollPassword] = useState('')
  const [enrollSecret, setEnrollSecret] = useState('')
  const [enrollUri, setEnrollUri] = useState('')
  const [enrollQr, setEnrollQr] = useState('')
  const [enrollCode, setEnrollCode] = useState('')
  const [enrollRevealKey, setEnrollRevealKey] = useState(false)

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

      if (mpRes.ok && mpData.requiresMfaEnrollment) {
        // Password verified, but this super-admin has never enrolled. Enter the
        // enrollment flow in place; do not enter the CRM.
        setEnrollmentToken(mpData.enrollmentToken)
        setEnrollPassword(password)
        setPassword('')
        setStep('enroll')
        await startEnrollment(mpData.enrollmentToken, password)
        return
      }

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

      toast.error(mpData.error || 'Invalid credentials')
      setIsLoading(false)
      return
    } catch {
      toast.error('Something went wrong')
      setIsLoading(false)
    }
  }

  const clearEnrollment = () => {
    setEnrollSecret('')
    setEnrollUri('')
    setEnrollQr('')
    setEnrollCode('')
    setEnrollPassword('')
    setEnrollRevealKey(false)
  }

  const startEnrollment = async (token: string, currentPassword: string) => {
    try {
      const res = await fetch('/api/admin/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentToken: token, currentPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not start two-factor setup.')
        clearEnrollment()
        setEnrollmentToken('')
        setStep('login')
        return
      }
      setEnrollSecret(String(data.secret || ''))
      setEnrollUri(String(data.uri || ''))
      const QRCode = (await import('qrcode')).default
      const canvasData = await QRCode.toDataURL(String(data.uri || ''), {
        width: 208,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
      setEnrollQr(canvasData)
    } catch {
      toast.error('Could not start two-factor setup.')
      clearEnrollment()
      setEnrollmentToken('')
      setStep('login')
    }
  }

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(enrollCode.trim())) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentToken, totpCode: enrollCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not confirm two-factor setup.')
        setIsLoading(false)
        return
      }

      // Enrollment complete. Consume everything and require a fresh login so the
      // normal MFA sign-in path is proven independently of enrollment.
      clearEnrollment()
      setEnrollmentToken('')
      setTotpCode('')
      setStep('login')
      setIsLoading(false)
      toast.success('Two-factor authentication enabled successfully. Please sign in again.')
      window.location.href = '/admin/login'
    } catch {
      toast.error('Could not confirm two-factor setup.')
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

  if (step === 'enroll') {
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
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-dark-900 mb-1">Set up two-factor authentication</h2>
            <p className="text-sm text-gray-600 mb-6">
              Your super-admin account must enable two-factor authentication before you can sign in.
            </p>

            <ol className="space-y-2 text-sm text-gray-700 mb-6">
              <li>1. Scan the QR code with your authenticator app.</li>
              <li>2. Enter the 6-digit code it shows.</li>
            </ol>

            {enrollQr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={enrollQr} alt="Authenticator QR code" width={208} height={208} className="mx-auto mb-4" />
            )}

            {enrollSecret && (
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Manual setup key</p>
                {enrollRevealKey ? (
                  <code className="mt-1 block break-all text-xs text-gray-800">{enrollSecret}</code>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEnrollRevealKey(true)}
                    className="mt-1 text-xs font-semibold text-gray-700 underline"
                  >
                    Reveal setup key
                  </button>
                )}
              </div>
            )}

            <form onSubmit={confirmEnrollment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  6-digit authenticator code
                </label>
                <input
                  value={enrollCode}
                  onChange={e => setEnrollCode(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none tracking-widest"
                  placeholder="000000"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !/^\d{6}$/.test(enrollCode.trim())}
                className="w-full py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 transition disabled:opacity-50"
              >
                {isLoading ? 'Confirming\u2026' : 'Confirm and enable'}
              </button>
            </form>

            <p className="mt-4 text-xs text-gray-500">
              After enabling, you will be asked to sign in again with your authenticator code.
            </p>
          </div>
        </div>
      </div>
    )
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
