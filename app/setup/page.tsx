'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiSettings, FiPlus, FiRefreshCw } from 'react-icons/fi'

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const runSetup = async () => {
    setLoading(true)
    setStatus('Setting up...')
    
    try {
      // Try to create table first
      const res = await fetch('/api/industries/init', { method: 'POST' })
      const data = await res.json()
      
      if (res.ok) {
        setStatus('Table created!')
        toast.success('Industries setup complete!')
        
        // Now fetch industries
        const fetchRes = await fetch('/api/industries')
        const industries = await fetchRes.json()
        
        if (Array.isArray(industries)) {
          setStatus(`Success! Found ${industries.length} industries.`)
          toast.success(`Found ${industries.length} industries!`)
        }
      } else {
        setStatus(data.error || 'Failed')
        toast.error(data.error || 'Failed')
      }
    } catch (err: any) {
      setStatus(err?.message || 'Error')
      toast.error('Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <FiSettings className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-dark-900 mb-4">Setup Industries</h1>
        
        {status && (
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <p className="text-sm">{status}</p>
          </div>
        )}
        
        <button
          onClick={runSetup}
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <FiRefreshCw className="animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <FiPlus />
              Setup Industries
            </>
          )}
        </button>
      </div>
    </div>
  )
}