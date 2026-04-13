'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  branchId: string | null
}

export function useCustomSession() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  return { user, loading, isSuperAdmin: user?.role === 'SUPER_ADMIN' }
}

export function useRequireAuth() {
  const { user, loading } = useCustomSession()

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/admin/login'
    }
  }, [loading, user])

  return { user, loading }
}
