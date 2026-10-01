'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiEdit2,
  FiKey,
  FiLock,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiUserCheck,
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
import {
  CrmConfirmDialog,
  CrmDrawer,
  CrmModal,
} from '@/components/crm/v2/CrmOverlays'
import { CrmStepUpModal } from '@/components/crm/v2/CrmStepUpModal'

interface StaffUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string
  totpEnabled: boolean
  actionsToday: number
  lastActiveAt: string | null
  isOnline: boolean
  assignedCountries: string[]
}

interface StaffCapabilities {
  create: boolean
  edit: boolean
  delete: boolean
  permissions: boolean
}

interface PermissionRow {
  permission: string
  class: 'OWNER_ONLY' | 'SENSITIVE' | 'NORMAL' | 'READ' | 'SYSTEM_ONLY'
  allowed: boolean
  source: string
}

interface PermissionOverrideRow {
  permission: string
  effect: 'ALLOW' | 'DENY'
}

type OverrideChoice = 'INHERIT' | 'ALLOW' | 'DENY'
type StepUpAction =
  | 'staff.create'
  | 'staff.account.update'
  | 'staff.delete'
  | 'staff.permission.change'

const ROLES = [
  'SUPER_ADMIN',
  'MANAGER',
  'FINANCE',
  'SUPPORT',
  'USER_MANAGEMENT',
  'TECHNICAL',
]

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

function permissionGroup(permission: string) {
  const prefix = permission.split(':')[0] || 'other'
  return prefix.replaceAll('_', ' ')
}

export default function StaffManagementPage() {
  const { user: currentUser } = useAdminSession()

  const [staff, setStaff] = useState<StaffUser[]>([])
  const [capabilities, setCapabilities] = useState<StaffCapabilities>({
    create: false,
    edit: false,
    delete: false,
    permissions: false,
  })
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'SUPPORT',
    password: '',
    assignedCountries: '',
  })

  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null)

  const [permissionTarget, setPermissionTarget] = useState<StaffUser | null>(null)
  const [permissionRows, setPermissionRows] = useState<PermissionRow[]>([])
  const [permissionChoices, setPermissionChoices] = useState<Record<string, OverrideChoice>>({})
  const [permissionLoading, setPermissionLoading] = useState(false)

  const [stepUp, setStepUp] = useState<{
    actionId: StepUpAction
    title: string
    execute: (proof: string) => Promise<void>
  } | null>(null)

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    setAccessDenied(false)
    try {
      const response = await fetch('/api/admin/admins', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (response.status === 403) {
        setAccessDenied(true)
        setStaff([])
        return
      }
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to load staff')
      }

      setStaff(body?.admins || [])
      setCapabilities(body?.actions || {
        create: false,
        edit: false,
        delete: false,
        permissions: false,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return staff
    return staff.filter(item =>
      item.firstName.toLowerCase().includes(query) ||
      item.lastName.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query) ||
      item.role.toLowerCase().includes(query) ||
      item.assignedCountries.some(country => country.toLowerCase().includes(query))
    )
  }, [search, staff])

  const metrics = useMemo(() => ({
    active: staff.filter(item => item.isActive).length,
    online: staff.filter(item => item.isOnline).length,
    twoFactor: staff.filter(item => item.totpEnabled).length,
  }), [staff])

  function requestStepUp(
    actionId: StepUpAction,
    title: string,
    execute: (proof: string) => Promise<void>
  ) {
    setStepUp({ actionId, title, execute })
  }

  async function runWithProof(proof: string) {
    const operation = stepUp
    if (!operation) return
    await operation.execute(proof)
    setStepUp(null)
  }

  function openCreate() {
    setEditing(null)
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      role: 'SUPPORT',
      password: '',
      assignedCountries: '',
    })
    setFormOpen(true)
  }

  function openEdit(item: StaffUser) {
    setEditing(item)
    setForm({
      email: item.email,
      firstName: item.firstName,
      lastName: item.lastName,
      role: item.role,
      password: '',
      assignedCountries: item.assignedCountries.join(', '),
    })
    setFormOpen(true)
  }

  function beginSaveStaff() {
    if (editing) {
      if (!capabilities.edit) return
      requestStepUp(
        'staff.account.update',
        'Verify staff account change',
        proof => saveStaff(proof)
      )
    } else {
      if (!capabilities.create) return
      requestStepUp(
        'staff.create',
        'Verify new staff account',
        proof => saveStaff(proof)
      )
    }
  }

  async function saveStaff(proof: string) {
    const assignedCountries = form.assignedCountries
      .split(',')
      .map(item => item.trim().toUpperCase())
      .filter(Boolean)

    const response = await fetch('/api/admin/admins', {
      method: editing ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CRM-Step-Up': proof,
      },
      body: JSON.stringify(
        editing
          ? {
              id: editing.id,
              role: form.role,
              assignedCountries,
              ...(form.password ? { password: form.password } : {}),
            }
          : {
              email: form.email.trim(),
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              role: form.role,
              password: form.password,
              assignedCountries,
            }
      ),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const details = Array.isArray(body?.details) ? ` · ${body.details.join(', ')}` : ''
      throw new Error((body?.error || 'Staff update failed') + details)
    }

    toast.success(editing ? 'Staff account updated' : 'Staff account created')
    setFormOpen(false)
    setEditing(null)
    setForm(current => ({ ...current, password: '' }))
    await fetchStaff()
  }

  function beginToggle(item: StaffUser) {
    if (!capabilities.edit || item.id === currentUser?.id) return
    requestStepUp(
      'staff.account.update',
      item.isActive ? 'Verify staff deactivation' : 'Verify staff activation',
      async proof => {
        const response = await fetch('/api/admin/admins', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CRM-Step-Up': proof,
          },
          body: JSON.stringify({
            id: item.id,
            isActive: !item.isActive,
          }),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body?.error || 'Staff status update failed')
        toast.success(item.isActive ? 'Staff account deactivated' : 'Staff account activated')
        await fetchStaff()
      }
    )
  }

  async function deleteStaff(proof: string, item: StaffUser) {
    const response = await fetch(`/api/admin/admins?id=${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CRM-Step-Up': proof },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error || 'Failed to remove staff account')

    toast.success('Staff account removed')
    setDeleteTarget(null)
    await fetchStaff()
  }

  async function openPermissions(item: StaffUser) {
    if (!capabilities.permissions || item.id === currentUser?.id) return
    setPermissionTarget(item)
    setPermissionLoading(true)
    setPermissionRows([])
    setPermissionChoices({})

    try {
      const response = await fetch(`/api/admin/admins/${encodeURIComponent(item.id)}/permissions`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Failed to load staff permissions')

      const rows: PermissionRow[] = body?.permissions || []
      const overrides: PermissionOverrideRow[] = body?.overrides || []
      const choices: Record<string, OverrideChoice> = {}
      for (const override of overrides) {
        choices[override.permission] = override.effect
      }

      setPermissionRows(rows)
      setPermissionChoices(choices)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load permissions')
      setPermissionTarget(null)
    } finally {
      setPermissionLoading(false)
    }
  }

  function beginSavePermissions() {
    if (!permissionTarget || !capabilities.permissions) return
    requestStepUp(
      'staff.permission.change',
      'Verify permission change',
      proof => savePermissions(proof)
    )
  }

  async function savePermissions(proof: string) {
    if (!permissionTarget) return

    const overrides = Object.entries(permissionChoices)
      .filter(([, effect]) => effect === 'ALLOW' || effect === 'DENY')
      .map(([permission, effect]) => ({ permission, effect }))

    const response = await fetch(
      `/api/admin/admins/${encodeURIComponent(permissionTarget.id)}/permissions`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Step-Up': proof,
        },
        body: JSON.stringify({ overrides }),
      }
    )
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error || 'Failed to update permissions')

    toast.success('Staff permissions updated and active sessions revoked')
    setPermissionTarget(null)
    await fetchStaff()
  }

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>()
    for (const row of permissionRows) {
      const group = permissionGroup(row.permission)
      const current = groups.get(group) || []
      current.push(row)
      groups.set(group, current)
    }
    return [...groups.entries()]
      .map(([group, rows]) => ({
        group,
        rows: rows.sort((a, b) => a.permission.localeCompare(b.permission)),
      }))
      .sort((a, b) => a.group.localeCompare(b.group))
  }, [permissionRows])

  if (accessDenied) {
    return (
      <CrmState
        type="permission"
        title="Staff access is restricted"
        description="Your current CRM role or permission overrides do not allow access to staff management."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Governance"
        title="Staff"
        description="Manage CRM operators, market scope, two-factor protection and granular action permissions. Privileged changes require one-time step-up authentication."
        actions={
          <>
            <Link href="/admin/admins/activity">
              <CrmButton variant="secondary">
                <FiActivity size={14} />
                Staff activity
              </CrmButton>
            </Link>
            <CrmButton variant="secondary" onClick={fetchStaff} disabled={loading}>
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </CrmButton>
            {capabilities.create && (
              <CrmButton variant="primary" onClick={openCreate}>
                <FiPlus size={14} />
                Add staff
              </CrmButton>
            )}
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Staff accounts"
          value={staff.length.toLocaleString()}
          helper="Non-deleted CRM operators"
          icon={<FiUsers size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Active"
          value={metrics.active.toLocaleString()}
          helper="Can authenticate if not otherwise blocked"
          icon={<FiUserCheck size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Online"
          value={metrics.online.toLocaleString()}
          helper="Activity within the last five minutes"
          icon={<FiActivity size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="2FA protected"
          value={metrics.twoFactor.toLocaleString()}
          helper="Authenticator enabled"
          icon={<FiShield size={16} />}
          tone={metrics.twoFactor === staff.length && staff.length > 0 ? 'success' : 'warning'}
        />
      </section>

      <CrmFilterBar>
        <div className="relative min-w-0 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search staff name, email, role or market..."
            className={`${crmInputClass} pl-9`}
          />
        </div>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading staff"
          description="Loading live staff, activity and security state."
        />
      ) : filtered.length === 0 ? (
        <CrmState
          type="empty"
          title="No staff match this view"
          description="Change the search query to find another operator."
        />
      ) : (
        <CrmTableFrame
          title="CRM operators"
          description="Role templates are combined with live per-staff ALLOW/DENY overrides and market scope on every guarded request."
        >
          <table className={`${crmTableClass} min-w-[1240px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Staff member</th>
                <th className={crmThClass}>Role</th>
                <th className={crmThClass}>Markets</th>
                <th className={crmThClass}>2FA</th>
                <th className={crmThClass}>Status</th>
                <th className={crmThClass}>Actions today</th>
                <th className={crmThClass}>Last active</th>
                <th className={`${crmThClass} text-right`}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isSelf = item.id === currentUser?.id
                return (
                  <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--crm-accent-soft)] text-xs font-bold text-amber-800">
                          {(item.firstName?.[0] || 'S').toUpperCase()}
                          {(item.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {item.firstName} {item.lastName}
                            </span>
                            {isSelf && <CrmBadge tone="amber">You</CrmBadge>}
                          </div>
                          <div className="mt-0.5 max-w-[260px] truncate text-xs text-slate-400">
                            {item.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={roleTone(item.role)} dot>
                        {roleLabel(item.role)}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {item.role === 'SUPER_ADMIN' ? (
                          <CrmBadge tone="amber">All markets</CrmBadge>
                        ) : item.assignedCountries.length ? (
                          item.assignedCountries.map(country => (
                            <CrmBadge key={country}>{country}</CrmBadge>
                          ))
                        ) : (
                          <CrmBadge tone="danger">No market</CrmBadge>
                        )}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={item.totpEnabled ? 'success' : 'warning'} dot>
                        {item.totpEnabled ? 'Enabled' : 'Not enabled'}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <div className="space-y-1">
                        <CrmBadge tone={item.isActive ? 'success' : 'danger'} dot>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </CrmBadge>
                        <div className="text-[10px] text-slate-400">
                          {item.isOnline ? 'Online now' : 'Offline'}
                        </div>
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <span className="text-sm font-semibold text-slate-800">
                        {Number(item.actionsToday || 0).toLocaleString()}
                      </span>
                    </td>

                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-600">{formatDate(item.lastActiveAt)}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        Login: {formatDate(item.lastLoginAt)}
                      </div>
                    </td>

                    <td className={`${crmTdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        {capabilities.permissions && !isSelf && item.role !== 'SUPER_ADMIN' && (
                          <button
                            type="button"
                            onClick={() => openPermissions(item)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                            title="Granular permissions"
                          >
                            <FiKey size={14} />
                          </button>
                        )}

                        {capabilities.edit && !isSelf && (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--crm-border)] bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700"
                            title="Edit role, market or password"
                          >
                            <FiEdit2 size={14} />
                          </button>
                        )}

                        {capabilities.edit && !isSelf && (
                          <button
                            type="button"
                            onClick={() => beginToggle(item)}
                            className={`grid h-8 w-8 place-items-center rounded-lg border ${
                              item.isActive
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                            title={item.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <FiUserCheck size={14} />
                          </button>
                        )}

                        {capabilities.delete && !isSelf && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            title="Remove staff account"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CrmTableFrame>
      )}

      <CrmModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit staff account' : 'Create staff account'}
        description={
          editing
            ? 'Changing role, market scope or password revokes active sessions and requires step-up authentication.'
            : 'New CRM staff accounts require a strong password and one-time step-up authentication.'
        }
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </CrmButton>
            <CrmButton variant="primary" onClick={beginSaveStaff}>
              <FiLock size={14} />
              {editing ? 'Verify & save' : 'Verify & create'}
            </CrmButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">First name</label>
                <input
                  value={form.firstName}
                  onChange={event => setForm(current => ({ ...current, firstName: event.target.value }))}
                  className={crmInputClass}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Last name</label>
                <input
                  value={form.lastName}
                  onChange={event => setForm(current => ({ ...current, lastName: event.target.value }))}
                  className={crmInputClass}
                  maxLength={80}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                  className={crmInputClass}
                />
              </div>
            </>
          )}

          {editing && (
            <div className="sm:col-span-2 rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3">
              <div className="text-sm font-semibold text-slate-900">
                {editing.firstName} {editing.lastName}
              </div>
              <div className="mt-1 text-xs text-slate-500">{editing.email}</div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Role</label>
            <select
              value={form.role}
              onChange={event => setForm(current => ({ ...current, role: event.target.value }))}
              className={crmInputClass}
            >
              {ROLES.map(role => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Markets</label>
            <input
              value={form.assignedCountries}
              onChange={event => setForm(current => ({ ...current, assignedCountries: event.target.value }))}
              className={crmInputClass}
              placeholder="LK, CA"
              disabled={form.role === 'SUPER_ADMIN'}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {editing ? 'New password (optional)' : 'Initial password'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              className={crmInputClass}
              autoComplete="new-password"
            />
            <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
              MaintainEX enforces the canonical strong-password policy and peppered password hashing on the server.
            </p>
          </div>
        </div>
      </CrmModal>

      <CrmDrawer
        open={Boolean(permissionTarget)}
        onClose={() => setPermissionTarget(null)}
        title="Granular staff permissions"
        description={
          permissionTarget
            ? `${permissionTarget.firstName} ${permissionTarget.lastName} · ${roleLabel(permissionTarget.role)}`
            : undefined
        }
        width="max-w-3xl"
        footer={
          <>
            <CrmButton variant="secondary" onClick={() => setPermissionTarget(null)}>
              Cancel
            </CrmButton>
            <CrmButton
              variant="primary"
              onClick={beginSavePermissions}
              disabled={permissionLoading || !permissionTarget}
            >
              <FiShield size={14} />
              Verify & save permissions
            </CrmButton>
          </>
        }
      >
        {permissionLoading ? (
          <CrmState
            type="loading"
            title="Loading permissions"
            description="Calculating role template, overrides and effective permission state."
          />
        ) : permissionTarget?.role === 'SUPER_ADMIN' ? (
          <CrmState
            type="permission"
            title="Owner permissions are not overrideable"
            description="SUPER_ADMIN capabilities are governed by the owner role and cannot be rewritten through staff overrides."
          />
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Explicit DENY wins over the role template. Explicit ALLOW is only accepted for delegable permissions. OWNER_ONLY and SYSTEM_ONLY capabilities cannot be overridden. Saving changes revokes this staff member&apos;s active CRM sessions.
            </div>

            {groupedPermissions.map(group => (
              <section key={group.group} className="rounded-2xl border border-[var(--crm-border)] bg-white">
                <div className="border-b border-[var(--crm-border)] px-4 py-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    {group.group}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.rows.map(row => {
                    const choice = permissionChoices[row.permission] || 'INHERIT'
                    const locked = row.class === 'OWNER_ONLY' || row.class === 'SYSTEM_ONLY'
                    return (
                      <div
                        key={row.permission}
                        className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_160px]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {row.permission}
                            </span>
                            <CrmBadge
                              tone={
                                row.class === 'OWNER_ONLY' || row.class === 'SYSTEM_ONLY'
                                  ? 'danger'
                                  : row.class === 'SENSITIVE'
                                    ? 'warning'
                                    : row.class === 'READ'
                                      ? 'info'
                                      : 'neutral'
                              }
                            >
                              {row.class}
                            </CrmBadge>
                            <CrmBadge tone={row.allowed ? 'success' : 'neutral'} dot>
                              {row.allowed ? 'Effective allow' : 'Effective deny'}
                            </CrmBadge>
                          </div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                            Source: {row.source.replaceAll('_', ' ')}
                          </div>
                        </div>

                        <select
                          value={choice}
                          onChange={event => setPermissionChoices(current => ({
                            ...current,
                            [row.permission]: event.target.value as OverrideChoice,
                          }))}
                          className={crmInputClass}
                          disabled={locked}
                          aria-label={`Override ${row.permission}`}
                        >
                          <option value="INHERIT">Inherit role</option>
                          <option value="ALLOW">Explicit allow</option>
                          <option value="DENY">Explicit deny</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </CrmDrawer>

      <CrmConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          const target = deleteTarget
          setDeleteTarget(null)
          requestStepUp(
            'staff.delete',
            'Verify staff removal',
            proof => deleteStaff(proof, target)
          )
        }}
        title="Remove this staff account?"
        description={
          deleteTarget
            ? `${deleteTarget.firstName} ${deleteTarget.lastName} will be soft-deleted and all active CRM sessions will be revoked. Audit history is preserved.`
            : ''
        }
        confirmLabel="Continue to verification"
        dangerous
      />

      <CrmStepUpModal
        open={Boolean(stepUp)}
        actionId={stepUp?.actionId || 'staff.account.update'}
        title={stepUp?.title}
        onClose={() => setStepUp(null)}
        onVerified={runWithProof}
      />
    </div>
  )
}
