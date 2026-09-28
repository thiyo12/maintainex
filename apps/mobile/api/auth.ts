import { request } from './client'
import { AuthResponse, User } from '../lib/types'

// Auth
export const auth = {
  register: (data: { name: string; phone: string; email?: string; role: string }) =>
    request<any>('/api/mobile/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/api/mobile/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  loginWithOtp: (data: { phone: string; otp: string }) =>
    request<AuthResponse>('/api/mobile/auth/login', { method: 'POST', body: JSON.stringify({ phone: data.phone, password: data.otp }) }),
  otpLogin: (data: { email?: string; phone?: string; code?: string }) =>
    request<AuthResponse>('/api/mobile/auth/otp-login', { method: 'POST', body: JSON.stringify(data) }),
  requestOtp: (phone: string) =>
    request<{ success: boolean }>('/api/mobile/auth/otp-login', { method: 'POST', body: JSON.stringify({ phone }) }),
  sendOtp: (data: { email: string }) =>
    request<{ success: boolean }>('/api/mobile/auth/send-otp', { method: 'POST', body: JSON.stringify(data) }),
  verifyOtp: (data: { email?: string; phone?: string; code: string; purpose?: string }) =>
    request<any>('/api/mobile/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<{ user: User; needsOnboarding?: boolean }>('/api/mobile/auth/me'),
  updateProfile: (data: { name?: string; phone?: string; profileImage?: string; birthday?: string; gender?: string; language?: string; emergencyContact?: string }) =>
    request<{ user: User }>('/api/mobile/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  switchRole: (role: string) =>
    request<AuthResponse>('/api/mobile/auth/switch-role', { method: 'PUT', body: JSON.stringify({ role }) }),
  forgotPassword: (data: { email: string }) =>
    request<{ success: boolean }>('/api/mobile/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    request<AuthResponse>('/api/mobile/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: () =>
    request<{ success: boolean }>('/api/mobile/auth/me', { method: 'DELETE' }),
}
