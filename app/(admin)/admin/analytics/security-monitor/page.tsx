'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FiShield, FiLock, FiUnlock, FiAlertTriangle, FiClock, FiGlobe,
  FiActivity, FiArrowUp, FiArrowDown, FiRefreshCw, FiX, FiPlus,
  FiWifi, FiServer, FiEye, FiUserX
} from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'

interface SecurityData {
  summary: {
    totalEventsToday: number
    blockedIPs: number
    failedLogins: number
    highRiskEvents: number
    activeSessions: number
    apiRequestsLastHour: number
  }
  recentEvents: Array<{
    id: string
    action: string
    category: string
    userId: string | null
    riskLevel: string
    ipAddress: string | null
    description: string
    createdAt: string
  }>
  blockedIPs: Array<{
    ip: string
    reason: string
    blockedAt: string
    expiresAt: string
  }>
  loginAttempts: {
    success: number
    failed: number
    byHour: Array<{ hour: string; success: number; failed: number }>
  }
  riskDistribution: Record<string, number>
  topThreats: Array<{
    ip: string
    attempts: number
    riskLevel: string
    reason: string
  }>
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  MEDIUM: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  HIGH: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
}

const ACTION_ICONS: Record<string, any> = {
  LOGIN: FiEye,
  LOGIN_FAILED: FiUserX,
  LOGOUT: FiLock,
  IP_BLOCK: FiShield,
  IP_UNBLOCK: FiUnlock,
  API_CALL: FiServer,
}

const DURATION_OPTIONS = [
  { label: '1 hour', value: 60 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 },
  { label: '7 days', value: 10080 },
  { label: 'Permanent', value: undefined },
]

export default function SecurityMonitorPage() {
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockIP, setBlockIP] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blockDuration, setBlockDuration] = useState<number | undefined>(360)
  const [blocking, setBlocking] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/security/monitor', { headers: { } })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Failed to load security data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleBlockIP = async () => {
    if (!blockIP.trim() || !blockReason.trim()) {
      toast.error('IP and reason are required')
      return
    }
    setBlocking(true)
    try {
      const res = await fetch('/api/admin/security/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: blockIP.trim(), reason: blockReason.trim(), durationMinutes: blockDuration }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(`IP ${blockIP} blocked successfully`)
        setShowBlockModal(false)
        setBlockIP('')
        setBlockReason('')
        fetchData()
      } else {
        toast.error(json.error || 'Failed to block IP')
      }
    } catch {
      toast.error('Failed to block IP')
    } finally {
      setBlocking(false)
    }
  }

  const handleUnblockIP = async (ip: string) => {
    try {
      const res = await fetch('/api/admin/security/blocked-ips', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      })
      if (res.ok) {
        toast.success(`IP ${ip} unblocked`)
        fetchData()
      } else {
        toast.error('Failed to unblock IP')
      }
    } catch {
      toast.error('Failed to unblock IP')
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

  const maxHourly = data
    ? Math.max(...data.loginAttempts.byHour.map(h => Math.max(h.success, h.failed)), 1)
    : 1

  const totalRisk = data
    ? Math.max(Object.values(data.riskDistribution).reduce((a, b) => a + b, 0), 1)
    : 1

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FiShield className="text-amber-500" /> Security Monitor
            </h1>
            <p className="text-gray-400 text-sm mt-1">Real-time security event monitoring</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
            <button onClick={fetchData} className="p-2 rounded-lg bg-[#15161E] border border-white/10 text-gray-400 hover:text-white transition-colors">
              <FiRefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Events Today', value: data.summary.totalEventsToday, icon: FiActivity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Blocked IPs', value: data.summary.blockedIPs, icon: FiLock, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { label: 'Failed Logins', value: data.summary.failedLogins, icon: FiUserX, color: data.summary.failedLogins > 10 ? 'text-red-400' : 'text-yellow-400', bg: data.summary.failedLogins > 10 ? 'bg-red-500/10' : 'bg-yellow-500/10' },
                { label: 'High Risk', value: data.summary.highRiskEvents, icon: FiAlertTriangle, color: data.summary.highRiskEvents > 0 ? 'text-orange-400' : 'text-gray-400', bg: data.summary.highRiskEvents > 0 ? 'bg-orange-500/10' : 'bg-gray-500/10' },
                { label: 'Sessions', value: data.summary.activeSessions, icon: FiWifi, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'API Req/Hour', value: data.summary.apiRequestsLastHour, icon: FiServer, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
              ].map((card) => (
                <div key={card.label} className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                  <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <card.icon className={`${card.color} text-lg`} />
                  </div>
                  <div className="text-xl font-bold text-white">{card.value.toLocaleString()}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{card.label}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FiActivity className="text-amber-400" size={18} />
                  <h3 className="text-white font-semibold">Live Event Feed</h3>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {data.recentEvents.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4">No recent events</p>
                  ) : (
                    data.recentEvents.map((event) => {
                      const risk = RISK_COLORS[event.riskLevel] || RISK_COLORS.LOW
                      const Icon = ACTION_ICONS[event.action] || FiEye
                      return (
                        <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className={`w-8 h-8 ${risk.bg} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <Icon size={14} className={risk.text} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">{event.action}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${risk.bg} ${risk.text} border ${risk.border}`}>
                                {event.riskLevel}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5 truncate">{event.description}</p>
                            {event.ipAddress && (
                              <div className="flex items-center gap-1 mt-1 text-gray-500 text-[10px]">
                                <FiGlobe size={8} />
                                {event.ipAddress}
                              </div>
                            )}
                          </div>
                          <span className="text-gray-500 text-[10px] flex-shrink-0">
                            {formatDate(event.createdAt)}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4">Login Analytics</h3>
                  <div className="flex items-center gap-4 mb-4 text-sm">
                    <span className="text-green-400">Success: {data.loginAttempts.success}</span>
                    <span className="text-red-400">Failed: {data.loginAttempts.failed}</span>
                  </div>
                  <div className="space-y-1">
                    {data.loginAttempts.byHour.map((h) => (
                      <div key={h.hour} className="flex items-center gap-2">
                        <span className="text-gray-500 text-[10px] w-8">{h.hour}</span>
                        <div className="flex-1 flex items-center gap-0.5 h-3">
                          <div
                            className="h-full bg-green-500/60 rounded-l"
                            style={{ width: `${(h.success / maxHourly) * 100}%` }}
                          />
                          <div
                            className="h-full bg-red-500/60 rounded-r"
                            style={{ width: `${(h.failed / maxHourly) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4">Risk Distribution</h3>
                  <div className="space-y-3">
                    {Object.entries(data.riskDistribution).map(([level, count]) => {
                      const risk = RISK_COLORS[level] || RISK_COLORS.LOW
                      const pct = (count / totalRisk) * 100
                      return (
                        <div key={level}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm ${risk.text}`}>{level}</span>
                            <span className="text-sm text-gray-400">{count}</span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full ${risk.text.replace('text-', 'bg-')}/60 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FiLock className="text-amber-400" size={18} />
                    <h3 className="text-white font-semibold">Blocked IPs</h3>
                  </div>
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-[#0B0C12] rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
                  >
                    <FiPlus size={14} /> Block IP
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-3 py-2 text-gray-400 font-medium text-xs">IP</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-medium text-xs">Reason</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-medium text-xs hidden md:table-cell">Blocked</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-medium text-xs hidden lg:table-cell">Expires</th>
                        <th className="text-right px-3 py-2 text-gray-400 font-medium text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.blockedIPs.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-6 text-gray-500">No blocked IPs</td></tr>
                      ) : (
                        data.blockedIPs.map((b) => (
                          <tr key={b.ip} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-3 py-2 text-white font-mono text-xs">{b.ip}</td>
                            <td className="px-3 py-2 text-gray-400 text-xs truncate max-w-[200px]">{b.reason}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs hidden md:table-cell">{formatDate(b.blockedAt)}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs hidden lg:table-cell">{formatDate(b.expiresAt)}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleUnblockIP(b.ip)}
                                className="text-green-400 hover:text-green-300 text-xs font-medium transition-colors"
                              >
                                Unblock
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FiAlertTriangle className="text-amber-400" size={18} />
                  <h3 className="text-white font-semibold">Top Threats</h3>
                </div>
                <div className="space-y-2">
                  {data.topThreats.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4">No threats detected</p>
                  ) : (
                    data.topThreats.map((threat) => {
                      const risk = RISK_COLORS[threat.riskLevel] || RISK_COLORS.LOW
                      return (
                        <div key={threat.ip} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className={`w-8 h-8 ${risk.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                            <FiAlertTriangle size={14} className={risk.text} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-mono">{threat.ip}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${risk.bg} ${risk.text}`}>
                                {threat.riskLevel}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">{threat.attempts} attempts — {threat.reason}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {showBlockModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-[#15161E] border border-white/10 rounded-xl w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-white font-semibold text-lg">Block IP Address</h3>
                    <button onClick={() => setShowBlockModal(false)} className="text-gray-400 hover:text-white">
                      <FiX size={20} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">IP Address</label>
                      <input
                        type="text"
                        value={blockIP}
                        onChange={(e) => setBlockIP(e.target.value)}
                        placeholder="192.168.1.1"
                        className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">Reason</label>
                      <input
                        type="text"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Brute force attack"
                        className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1.5">Duration</label>
                      <select
                        value={blockDuration ?? ''}
                        onChange={(e) => setBlockDuration(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      >
                        {DURATION_OPTIONS.map((opt) => (
                          <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowBlockModal(false)}
                        className="flex-1 px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBlockIP}
                        disabled={blocking}
                        className="flex-1 px-4 py-2 bg-amber-500 text-[#0B0C12] rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50"
                      >
                        {blocking ? 'Blocking...' : 'Block IP'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}