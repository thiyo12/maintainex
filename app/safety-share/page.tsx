'use client'

import { useEffect, useState } from 'react'

type SharedStatus = {
  status: string
  market: string
  scheduledDate: string | null
  expiresAt: string
  note: string
}

export default function SafetySharePage() {
  const [status, setStatus] = useState<SharedStatus | null>(null)
  const [message, setMessage] = useState('Checking this private booking link…')

  useEffect(() => {
    let active = true
    const token = window.location.hash.slice(1)
    // The token is in the fragment, so it is not sent in the page request,
    // Referer header, or ordinary proxy access logs. Remove browser-history copy.
    window.history.replaceState(null, '', window.location.pathname)
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setMessage('This private booking link is invalid or expired.')
      return () => { active = false }
    }
    void fetch('/api/mobile/v2/safety-share', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async response => {
      const payload = await response.json()
      if (!response.ok) throw new Error('invalid-share')
      if (active) {
        setStatus(payload as SharedStatus)
        setMessage('')
      }
    }).catch(() => {
      if (active) setMessage('This private booking link is invalid or expired.')
    })
    return () => { active = false }
  }, [])

  return (
    <main style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.25rem', fontFamily: 'sans-serif' }}>
      <h1>Shared booking status</h1>
      {message ? <p role="status">{message}</p> : null}
      {status ? (
        <section aria-label="Booking status">
          <p><strong>Status:</strong> {status.status.replaceAll('_', ' ')}</p>
          <p><strong>Market:</strong> {status.market}</p>
          <p><strong>Scheduled date:</strong> {status.scheduledDate ? new Date(status.scheduledDate).toLocaleString() : 'Not scheduled'}</p>
          <p>{status.note}</p>
          <p>Link expires {new Date(status.expiresAt).toLocaleString()}.</p>
        </section>
      ) : null}
    </main>
  )
}
