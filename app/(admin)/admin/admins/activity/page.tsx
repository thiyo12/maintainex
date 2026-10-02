'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiArrowLeft,
  FiClock,
  FiLogOut,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUsers,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmFilterBar,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmConfirmDialog } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  actionsToday: number
  actionsThisWeek: number
  lastActiveAt: string | null
  isOnline: boolean
  actionBreakdown: {
    kycReviews: number
    userActions: number
    jobActions: number
  }
}

interface ActivityEntry {
  id: string
  adminUserId: string
  adminEmail: string
  adminName: string
  adminRole: string
  action: string
  targetTable: string | null
  targetId: string | null
  targetLabel: string | null
  ipAddress: string
  createdAt: string
}

interface ActivityData {
  staff: StaffMember[]
  recentActivity: ActivityEntry[]
  summary: {
    totalStaff: number
    onlineNow: number
    actionsToday: number
    actionsThisWeek: number
  }
}

interface SessionRow {
  id: string
  adminUserId: string
  staffName: string
  email: string
  role: string
  staffActive: boolean
  totpEnabled: boolean
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
  revokedAt: string | null
  state: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  isCurrent: boolean
  protectedOwnerSession: boolean
}

interface SessionData {
  sessions: SessionRow[]
  summary: {
    active: number
    revoked: number
    expired: number
  }
  canRevoke: boolean
  currentSessionId: string
}

const EMPTY_ACTIVITY: ActivityData = {
  staff: [],
  recentActivity: [],
  summary: { totalStaff: 0, onlineNow: 0, actionsToday: 0, actionsThisWeek: 0 },
}

const EMPTY_SESSIONS: SessionData = {
  sessions: [],
  summary: { active: 0, revoked: 0, expired: 0 },
  canRevoke: false,
  currentSessionId: '',
}

export default function StaffActivityPage() {
  const { user } = useAdminSession()
  const canView = Boolean(user?.permissions?.includes('staff:view'))

  const [activity, setActivity] = useState<ActivityData>(EMPTY_ACTIVITY)
  const [sessions, setSessions] = useState<SessionData>(EMPTY_SESSIONS)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('ALL')
  const [sessionState, setSessionState] = useState<'ALL' | SessionRow['state']>('ACTIVE')
  const [revokeTarget, setRevokeTarget] = useState<SessionRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [activityResponse, sessionResponse] = await Promise.all([
        fetch('/api/admin/staff/activity', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/staff/sessions', { credentials: 'include', cache: 'no-store' }),
      ])

      const [activityBody, sessionBody] = await Promise.all([
        activityResponse.json().catch(() => ({})),
        sessionResponse.json().catch(() => ({})),
      ])

      if (!activityResponse.ok) {
        throw new Error(activityBody?.error || 'Unable to load staff activity')
      }
      if (!sessionResponse.ok) {
        throw new Error(sessionBody?.error || 'Unable to load staff sessions')
      }

      setActivity({
        staff: activityBody.staff || [],
        recentActivity: activityBody.recentActivity || [],
        summary: activityBody.summary || EMPTY_ACTIVITY.summary,
      })
      setSessions({
        sessions: sessionBody.sessions || [],
        summary: sessionBody.summary || EMPTY_SESSIONS.summary,
        canRevoke: Boolean(sessionBody.canRevoke),
        currentSessionId: sessionBody.currentSessionId || '',
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load staff control data')
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  const filteredActivity = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activity.recentActivity.filter(item => {
      if (staffFilter !== 'ALL' && item.adminUserId !== staffFilter) return false
      if (!q) return true
      return [
        item.adminName,
        item.adminEmail,
        item.adminRole,
        item.action,
        item.targetTable,
        item.targetId,
        item.targetLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [activity.recentActivity, search, staffFilter])

  const filteredSessions = useMemo(
    () => sessions.sessions.filter(item => sessionState === 'ALL' || item.state === sessionState),
    [sessionState, sessions.sessions]
  )

  async function revokeSession() {
    if (!revokeTarget || !sessions.canRevoke) return
    setBusy(true)
    try {
      const response = await fetch('/api/admin/staff/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: revokeTarget.id }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Session revocation failed')

      const revokedCurrent = Boolean(body.revokedCurrentSession)
      setRevokeTarget(null)
      toast.success(revokedCurrent ? 'Current session revoked' : 'Staff session revoked')

      if (revokedCurrent) {
        window.location.href = '/admin/login'
        return
      }
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Session revocation failed')
    } finally {
      setBusy(false)
    }
  }

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Staff activity access required"
        description="Your effective CRM permissions do not allow staff activity visibility."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading staff control plane"
        description="Loading operator activity, audit metadata and live session state."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Governance · Staff"
        title="Activity & sessions"
        description="Monitor staff operations and revoke live sessions through the governed CRM action boundary. Audit history remains immutable."
        actions={
          <>
            <Link href="/admin/admins">
              <CrmButton variant="secondary">
                <FiArrowLeft size={14} />
                Staff directory
              </CrmButton>
            </Link>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
          </>
        }
        context={
          <>
            <CrmBadge tone="success" dot>Canonical staff permissions</CrmBadge>
            <CrmBadge tone={sessions.canRevoke ? 'warning' : 'neutral'}>
              {sessions.canRevoke ? 'Session revocation enabled' : 'Session read-only'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Staff accounts"
          value={activity.summary.totalStaff.toLocaleString()}
          helper="Active CRM operators"
          icon={<FiUsers size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Online now"
          value={activity.summary.onlineNow.toLocaleString()}
          helper="Recent operational activity"
          icon={<FiActivity size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Actions today"
          value={activity.summary.actionsToday.toLocaleString()}
          helper={`${activity.summary.actionsThisWeek.toLocaleString()} this week`}
          icon={<FiShield size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Active sessions"
          value={sessions.summary.active.toLocaleString()}
          helper={`${sessions.summary.revoked} revoked · ${sessions.summary.expired} expired`}
          icon={<FiClock size={16} />}
          tone={sessions.summary.active > 0 ? 'amber' : 'neutral'}
        />
      </section>

      <CrmFilterBar>
        <div className="relative min-w-0 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={14}
          />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            className={`${crmInputClass} pl-9`}
            placeholder="Search staff, action or target..."
          />
        </div>
        <select
          value={staffFilter}
          onChange={event => setStaffFilter(event.target.value)}
          className={`${crmInputClass} md:w-[220px]`}
        >
          <option value="ALL">All staff</option>
          {activity.staff.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} · {roleLabel(item.role)}
            </option>
          ))}
        </select>
      </CrmFilterBar>

      <CrmTableFrame
        title="Staff activity"
        description="Operational audit metadata. Security-sensitive payload values remain outside this view."
        action={<CrmBadge tone="neutral">{filteredActivity.length} recent</CrmBadge>}
      >
        <table className={`${crmTableClass} min-w-[940px]`}>
          <thead>
            <tr>
              <th className={crmThClass}>Time</th>
              <th className={crmThClass}>Staff</th>
              <th className={crmThClass}>Role</th>
              <th className={crmThClass}>Action</th>
              <th className={crmThClass}>Target</th>
              <th className={crmThClass}>Source</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivity.length === 0 ? (
              <tr>
                <td className={`${crmTdClass} text-center text-slate-400`} colSpan={6}>
                  No staff activity matches this filter.
                </td>
              </tr>
            ) : (
              filteredActivity.map(item => (
                <tr key={item.id}>
                  <td className={crmTdClass}>
                    <div className="text-xs text-slate-700">{formatDate(item.createdAt)}</div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="text-xs font-semibold text-slate-800">{item.adminName}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{item.adminEmail}</div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={roleTone(item.adminRole)}>{roleLabel(item.adminRole)}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={actionTone(item.action)}>{item.action}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <div className="max-w-[260px] truncate text-xs text-slate-700">
                      {item.targetLabel || item.targetId || item.targetTable || '—'}
                    </div>
                    {item.targetTable && (
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                        {item.targetTable}
                      </div>
                    )}
                  </td>
                  <td className={crmTdClass}>
                    <span className="font-mono text-[11px] text-slate-500">{maskIp(item.ipAddress)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CrmTableFrame>

      <CrmTableFrame
        title="Staff sessions"
        description="Token hashes and token-family identifiers are never exposed. Revocation takes effect immediately through live session state."
        action={
          <select
            value={sessionState}
            onChange={event => setSessionState(event.target.value as 'ALL' | SessionRow['state'])}
            className={`${crmInputClass} w-[150px]`}
          >
            <option value="ACTIVE">Active</option>
            <option value="ALL">All states</option>
            <option value="REVOKED">Revoked</option>
            <option value="EXPIRED">Expired</option>
          </select>
        }
      >
        <table className={`${crmTableClass} min-w-[1080px]`}>
          <thead>
            <tr>
              <th className={crmThClass}>Staff</th>
              <th className={crmThClass}>Role</th>
              <th className={crmThClass}>State</th>
              <th className={crmThClass}>2FA</th>
              <th className={crmThClass}>Last used</th>
              <th className={crmThClass}>Expires</th>
              <th className={crmThClass}>Device</th>
              <th className={crmThClass}>Control</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.length === 0 ? (
              <tr>
                <td className={`${crmTdClass} text-center text-slate-400`} colSpan={8}>
                  No sessions match this state.
                </td>
              </tr>
            ) : (
              filteredSessions.map(item => (
                <tr key={item.id}>
                  <td className={crmTdClass}>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{item.staffName}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">{item.email}</div>
                      </div>
                      {item.isCurrent && <CrmBadge tone="info">CURRENT</CrmBadge>}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={roleTone(item.role)}>{roleLabel(item.role)}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={sessionTone(item.state)} dot>{item.state}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={item.totpEnabled ? 'success' : 'warning'}>
                      {item.totpEnabled ? 'ENABLED' : 'NOT ENABLED'}
                    </CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <span className="text-xs text-slate-600">{formatDate(item.lastUsedAt || item.createdAt)}</span>
                  </td>
                  <td className={crmTdClass}>
                    <span className="text-xs text-slate-600">{formatDate(item.expiresAt)}</span>
                  </td>
                  <td className={crmTdClass}>
                    <div className="max-w-[210px] truncate text-[11px] text-slate-500">
                      {deviceLabel(item.userAgent)}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">{maskIp(item.ipAddress)}</div>
                  </td>
                  <td className={crmTdClass}>
                    {item.state === 'ACTIVE' && sessions.canRevoke && !item.protectedOwnerSession ? (
                      <CrmButton
                        size="sm"
                        variant={item.isCurrent ? 'danger' : 'secondary'}
                        onClick={() => setRevokeTarget(item)}
                      >
                        <FiLogOut size={12} />
                        Revoke
                      </CrmButton>
                    ) : item.protectedOwnerSession ? (
                      <CrmBadge tone="danger">OWNER PROTECTED</CrmBadge>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CrmTableFrame>

      <CrmConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => {
          if (!busy) setRevokeTarget(null)
        }}
        onConfirm={revokeSession}
        title="Revoke this staff session?"
        description={
          revokeTarget
            ? `${revokeTarget.staffName}'s session will stop authorizing CRM requests immediately. The action is written to the immutable security audit.`
            : ''
        }
        confirmLabel={revokeTarget?.isCurrent ? 'Revoke current session' : 'Revoke session'}
        dangerous
        busy={busy}
      />
    </div>
  )
}

function roleLabel(role: string) {
  return role.replaceAll('_', ' ')
}

function roleTone(role: string): CrmTone {
  if (role === 'SUPER_ADMIN') return 'danger'
  if (role === 'MANAGER') return 'info'
  if (role === 'FINANCE') return 'success'
  if (role === 'USER_MANAGEMENT') return 'amber'
  if (role === 'TECHNICAL') return 'neutral'
  return 'warning'
}

function actionTone(action: string): CrmTone {
  if (/REJECT|DELETE|BAN|SUSPEND|REVOKE|FAIL/i.test(action)) return 'danger'
  if (/APPROVE|CREATE|UNBAN|UNSUSPEND|SUCCESS/i.test(action)) return 'success'
  if (/UPDATE|CHANGE|SETTINGS|ASSIGN/i.test(action)) return 'warning'
  if (/LOGIN|VIEW|READ|EXPORT/i.test(action)) return 'info'
  return 'neutral'
}

function sessionTone(state: SessionRow['state']): CrmTone {
  if (state === 'ACTIVE') return 'success'
  if (state === 'REVOKED') return 'danger'
  return 'neutral'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function maskIp(value: string | null) {
  if (!value) return '—'
  if (value.includes(':')) {
    const parts = value.split(':')
    return `${parts.slice(0, 2).join(':')}:…`
  }
  const parts = value.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`
  return 'masked'
}

function deviceLabel(value: string | null) {
  if (!value) return 'Unknown device'
  if (/iPhone/i.test(value)) return 'iPhone'
  if (/iPad/i.test(value)) return 'iPad'
  if (/Android/i.test(value)) return 'Android'
  if (/Macintosh|Mac OS X/i.test(value)) return 'Mac'
  if (/Windows/i.test(value)) return 'Windows'
  if (/Linux/i.test(value)) return 'Linux'
  return 'Browser session'
}
