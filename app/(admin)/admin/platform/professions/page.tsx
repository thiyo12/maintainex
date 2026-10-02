'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiCheck,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTool,
  FiUserCheck,
  FiX,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmField,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTabs,
  crmInputClass,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'

interface Skill {
  id: string
  slug: string
  i18nKey: string
  description?: string | null
  isActive: boolean
  sortOrder: number
  _count?: {
    taskerSkills?: number
    companySkills?: number
  }
}

interface Profession {
  id: string
  slug: string
  i18nKey: string
  description?: string | null
  isActive: boolean
  sortOrder: number
  skills: Skill[]
  _count: {
    taskerProfessions: number
    companyProfessions: number
    serviceRequirements: number
  }
}

interface Submission {
  id: string
  submittedById: string
  requestedName: string
  description?: string | null
  suggestedServices?: string | null
  status: string
  createdAt: string
}

type ViewTab = 'professions' | 'submissions'

export default function ProfessionsManagementPage() {
  const { user } = useAdminSession()
  const canView = Boolean(user?.permissions?.includes('catalog:view'))
  const canEdit = Boolean(user?.permissions?.includes('catalog:edit'))
  const canPublish = Boolean(user?.permissions?.includes('catalog:publish'))

  const [professions, setProfessions] = useState<Profession[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ViewTab>('professions')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<Profession | null>(null)
  const [showProfession, setShowProfession] = useState(false)
  const [showSkill, setShowSkill] = useState(false)
  const [reviewing, setReviewing] = useState<Submission | null>(null)
  const [professionForm, setProfessionForm] = useState({
    slug: '',
    i18nKey: '',
    description: '',
    sortOrder: '0',
    isActive: false,
  })
  const [skillForm, setSkillForm] = useState({
    slug: '',
    i18nKey: '',
    description: '',
    sortOrder: '0',
    isActive: false,
  })
  const [reviewForm, setReviewForm] = useState({
    status: 'APPROVED',
    canonicalProfessionId: '',
    reviewNote: '',
  })

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [professionResponse, submissionResponse] = await Promise.all([
        fetch('/api/admin/professions', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/professions/submissions', { credentials: 'include', cache: 'no-store' }),
      ])
      const professionBody = await professionResponse.json().catch(() => ({}))
      const submissionBody = await submissionResponse.json().catch(() => ({}))

      if (!professionResponse.ok) {
        throw new Error(professionBody?.error || 'Unable to load professions')
      }
      if (!submissionResponse.ok) {
        throw new Error(submissionBody?.error || 'Unable to load profession submissions')
      }

      const nextProfessions = professionBody.professions || []
      setProfessions(nextProfessions)
      setSubmissions(submissionBody.submissions || [])

      if (selected) {
        setSelected(nextProfessions.find((item: Profession) => item.id === selected.id) || null)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load professions')
    } finally {
      setLoading(false)
    }
  }, [canView, selected?.id])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return professions
    return professions.filter(item =>
      [item.slug, item.i18nKey, item.description]
        .some(value => String(value || '').toLowerCase().includes(normalized))
    )
  }, [professions, query])

  const activeProfessions = professions.filter(item => item.isActive).length
  const activeSkills = professions.reduce(
    (count, profession) => count + profession.skills.filter(skill => skill.isActive).length,
    0
  )
  const providerAssignments = professions.reduce(
    (count, profession) =>
      count + profession._count.taskerProfessions + profession._count.companyProfessions,
    0
  )

  function openProfessionCreate() {
    if (!canEdit) return
    setProfessionForm({
      slug: '',
      i18nKey: '',
      description: '',
      sortOrder: '0',
      isActive: false,
    })
    setShowProfession(true)
  }

  async function createProfession() {
    if (!canEdit) return
    if (!professionForm.slug.trim() || !professionForm.i18nKey.trim()) {
      toast.error('Slug and i18n key are required')
      return
    }

    setBusy('create-profession')
    try {
      const response = await fetch('/api/admin/professions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...professionForm,
          sortOrder: Number(professionForm.sortOrder),
          isActive: canPublish && professionForm.isActive,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Profession creation failed')

      toast.success(
        canPublish && professionForm.isActive
          ? 'Profession created and published'
          : 'Profession created as inactive draft'
      )
      setShowProfession(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profession creation failed')
    } finally {
      setBusy(null)
    }
  }

  async function toggleProfession(profession: Profession) {
    if (!canPublish) return

    setBusy(profession.id)
    try {
      const response = await fetch('/api/admin/professions/' + profession.id, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !profession.isActive }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Profession publication update failed')
      toast.success(profession.isActive ? 'Profession deactivated' : 'Profession activated')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profession update failed')
    } finally {
      setBusy(null)
    }
  }

  function openSkillCreate(profession: Profession) {
    if (!canEdit) return
    setSelected(profession)
    setSkillForm({
      slug: '',
      i18nKey: '',
      description: '',
      sortOrder: '0',
      isActive: false,
    })
    setShowSkill(true)
  }

  async function createSkill() {
    if (!canEdit || !selected) return
    if (!skillForm.slug.trim() || !skillForm.i18nKey.trim()) {
      toast.error('Skill slug and i18n key are required')
      return
    }

    setBusy('create-skill')
    try {
      const response = await fetch('/api/admin/professions/' + selected.id + '/skills', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...skillForm,
          sortOrder: Number(skillForm.sortOrder),
          isActive: canPublish && skillForm.isActive,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Skill creation failed')

      toast.success(
        canPublish && skillForm.isActive
          ? 'Skill created and published'
          : 'Skill created as inactive draft'
      )
      setShowSkill(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Skill creation failed')
    } finally {
      setBusy(null)
    }
  }

  async function toggleSkill(profession: Profession, skill: Skill) {
    if (!canPublish) return

    setBusy(skill.id)
    try {
      const response = await fetch('/api/admin/professions/' + profession.id + '/skills', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: skill.id,
          isActive: !skill.isActive,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Skill publication update failed')
      toast.success(skill.isActive ? 'Skill deactivated' : 'Skill activated')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Skill update failed')
    } finally {
      setBusy(null)
    }
  }

  function openReview(submission: Submission) {
    if (!canPublish) return
    setReviewing(submission)
    setReviewForm({
      status: 'APPROVED',
      canonicalProfessionId: '',
      reviewNote: '',
    })
  }

  async function submitReview() {
    if (!canPublish || !reviewing) return
    if (
      (reviewForm.status === 'APPROVED' || reviewForm.status === 'DUPLICATE') &&
      !reviewForm.canonicalProfessionId
    ) {
      toast.error('Select the canonical profession')
      return
    }
    if (reviewForm.status === 'REJECTED' && reviewForm.reviewNote.trim().length < 4) {
      toast.error('A rejection reason is required')
      return
    }

    setBusy(reviewing.id)
    try {
      const response = await fetch('/api/admin/professions/submissions/' + reviewing.id, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewForm.status,
          canonicalProfessionId:
            reviewForm.status === 'REJECTED' ? undefined : reviewForm.canonicalProfessionId,
          reviewNote: reviewForm.reviewNote.trim() || undefined,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Submission review failed')

      toast.success('Profession submission reviewed')
      setReviewing(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Submission review failed')
    } finally {
      setBusy(null)
    }
  }

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Profession catalog access required"
        description="Your current staff permissions do not allow profession and skill taxonomy management."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading profession taxonomy"
        description="Loading professions, skills and pending provider submissions."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="App & Web · Provider taxonomy"
        title="Professions & skills"
        description="Manage the canonical capability taxonomy used by taskers, companies, service requirements and provider matching."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
            {canEdit && (
              <CrmButton variant="primary" onClick={openProfessionCreate}>
                <FiPlus size={14} />
                New profession
              </CrmButton>
            )}
          </>
        }
        context={
          <>
            <Link
              href="/admin/platform/catalog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              <FiArrowLeft size={12} />
              Catalog
            </Link>
            <CrmBadge tone={canEdit ? 'success' : 'neutral'} dot>
              {canEdit ? 'Taxonomy edit access' : 'Read-only'}
            </CrmBadge>
            <CrmBadge tone={canPublish ? 'amber' : 'neutral'}>
              {canPublish ? 'Publication authority' : 'Draft only'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Professions"
          value={professions.length.toLocaleString()}
          helper={String(activeProfessions) + ' active'}
          icon={<FiTool size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Active skills"
          value={activeSkills.toLocaleString()}
          helper="Published provider capabilities"
          icon={<FiCheck size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Provider assignments"
          value={providerAssignments.toLocaleString()}
          helper="Tasker + company profession links"
          icon={<FiUserCheck size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Pending submissions"
          value={submissions.length.toLocaleString()}
          helper="Awaiting taxonomy review"
          icon={<FiRefreshCw size={16} />}
          tone={submissions.length > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CrmTabs
          items={[
            { id: 'professions', label: 'Professions', count: professions.length },
            { id: 'submissions', label: 'Submissions', count: submissions.length },
          ]}
          active={tab}
          onChange={id => setTab(id as ViewTab)}
        />

        {tab === 'professions' && (
          <div className="relative w-full lg:w-80">
            <FiSearch
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search professions..."
              className={crmInputClass + ' pl-9'}
            />
          </div>
        )}
      </div>

      {tab === 'professions' ? (
        filtered.length === 0 ? (
          <CrmState
            type="empty"
            title="No professions found"
            description="No profession records match this search."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filtered.map(profession => (
              <CrmCard
                key={profession.id}
                title={profession.slug}
                description={profession.i18nKey}
                action={
                  <CrmBadge tone={profession.isActive ? 'success' : 'neutral'} dot>
                    {profession.isActive ? 'ACTIVE' : 'DRAFT'}
                  </CrmBadge>
                }
              >
                <p className="min-h-10 text-xs leading-5 text-slate-500">
                  {profession.description || 'No description stored.'}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniStat label="Skills" value={profession.skills.length} />
                  <MiniStat label="Taskers" value={profession._count.taskerProfessions} />
                  <MiniStat label="Companies" value={profession._count.companyProfessions} />
                </div>

                <div className="mt-4 border-t border-[var(--crm-border)] pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-700">Skills</div>
                    {canEdit && (
                      <CrmButton size="sm" variant="secondary" onClick={() => openSkillCreate(profession)}>
                        <FiPlus size={12} />
                        Add skill
                      </CrmButton>
                    )}
                  </div>

                  {profession.skills.length === 0 ? (
                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                      No skills defined.
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profession.skills.map(skill => (
                        <button
                          key={skill.id}
                          type="button"
                          disabled={!canPublish || busy === skill.id}
                          onClick={() => toggleSkill(profession, skill)}
                          className="disabled:cursor-default"
                          title={canPublish ? 'Toggle skill publication' : 'Publication permission required'}
                        >
                          <CrmBadge tone={skill.isActive ? 'success' : 'neutral'} dot>
                            {skill.slug}
                          </CrmBadge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--crm-border)] pt-4">
                  <div className="text-[11px] text-slate-400">
                    {profession._count.serviceRequirements} service requirement(s)
                  </div>
                  {canPublish && (
                    <CrmButton
                      size="sm"
                      variant={profession.isActive ? 'secondary' : 'primary'}
                      disabled={busy === profession.id}
                      onClick={() => toggleProfession(profession)}
                    >
                      {profession.isActive ? 'Deactivate' : 'Publish'}
                    </CrmButton>
                  )}
                </div>
              </CrmCard>
            ))}
          </div>
        )
      ) : submissions.length === 0 ? (
        <CrmState
          type="empty"
          title="No pending submissions"
          description="Provider-submitted profession requests will appear here for review."
        />
      ) : (
        <CrmCard
          title="Pending profession submissions"
          description="Review provider taxonomy requests against the canonical profession catalog."
          padding="none"
        >
          <div className="divide-y divide-[var(--crm-border)]">
            {submissions.map(submission => (
              <div
                key={submission.id}
                className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{submission.requestedName}</div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    {submission.description || 'No description provided.'}
                  </p>
                  <div className="mt-2 text-[10px] text-slate-400">
                    Submitted {new Date(submission.createdAt).toLocaleString('en-LK')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CrmBadge tone="warning">{submission.status}</CrmBadge>
                  {canPublish && (
                    <CrmButton size="sm" variant="primary" onClick={() => openReview(submission)}>
                      Review
                    </CrmButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CrmCard>
      )}

      <CrmModal
        open={showProfession}
        onClose={() => {
          if (busy !== 'create-profession') setShowProfession(false)
        }}
        title="Create profession"
        description="New professions are inactive drafts unless you also hold publication authority."
        footer={
          <>
            <CrmButton variant="secondary" onClick={() => setShowProfession(false)} disabled={busy === 'create-profession'}>
              Cancel
            </CrmButton>
            <CrmButton variant="primary" onClick={createProfession} disabled={busy === 'create-profession'}>
              {busy === 'create-profession' ? 'Creating...' : 'Create profession'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmField label="Slug" hint="Stable lowercase identifier used by APIs.">
            <input
              value={professionForm.slug}
              onChange={event => setProfessionForm(current => ({ ...current, slug: event.target.value }))}
              className={crmInputClass}
              placeholder="electrician"
            />
          </CrmField>
          <CrmField label="i18n key" hint="Translation key used by clients.">
            <input
              value={professionForm.i18nKey}
              onChange={event => setProfessionForm(current => ({ ...current, i18nKey: event.target.value }))}
              className={crmInputClass}
              placeholder="profession.electrician"
            />
          </CrmField>
          <CrmField label="Description">
            <textarea
              value={professionForm.description}
              onChange={event => setProfessionForm(current => ({ ...current, description: event.target.value }))}
              className={crmInputClass + ' h-auto min-h-[90px] resize-y py-2.5'}
            />
          </CrmField>
          <CrmField label="Sort order">
            <input
              type="number"
              value={professionForm.sortOrder}
              onChange={event => setProfessionForm(current => ({ ...current, sortOrder: event.target.value }))}
              className={crmInputClass}
            />
          </CrmField>
          <PublishToggle
            checked={canPublish && professionForm.isActive}
            disabled={!canPublish}
            onChange={value => setProfessionForm(current => ({ ...current, isActive: value }))}
            label="Publish immediately"
          />
        </div>
      </CrmModal>

      <CrmModal
        open={showSkill}
        onClose={() => {
          if (busy !== 'create-skill') setShowSkill(false)
        }}
        title="Create profession skill"
        description={selected ? 'Add a skill to ' + selected.slug + '. New skills are draft-first.' : 'Add profession skill.'}
        footer={
          <>
            <CrmButton variant="secondary" onClick={() => setShowSkill(false)} disabled={busy === 'create-skill'}>
              Cancel
            </CrmButton>
            <CrmButton variant="primary" onClick={createSkill} disabled={busy === 'create-skill'}>
              {busy === 'create-skill' ? 'Creating...' : 'Create skill'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmField label="Skill slug">
            <input
              value={skillForm.slug}
              onChange={event => setSkillForm(current => ({ ...current, slug: event.target.value }))}
              className={crmInputClass}
              placeholder="three-phase-wiring"
            />
          </CrmField>
          <CrmField label="i18n key">
            <input
              value={skillForm.i18nKey}
              onChange={event => setSkillForm(current => ({ ...current, i18nKey: event.target.value }))}
              className={crmInputClass}
              placeholder="skill.electrician.three_phase_wiring"
            />
          </CrmField>
          <CrmField label="Description">
            <textarea
              value={skillForm.description}
              onChange={event => setSkillForm(current => ({ ...current, description: event.target.value }))}
              className={crmInputClass + ' h-auto min-h-[90px] resize-y py-2.5'}
            />
          </CrmField>
          <CrmField label="Sort order">
            <input
              type="number"
              value={skillForm.sortOrder}
              onChange={event => setSkillForm(current => ({ ...current, sortOrder: event.target.value }))}
              className={crmInputClass}
            />
          </CrmField>
          <PublishToggle
            checked={canPublish && skillForm.isActive}
            disabled={!canPublish}
            onChange={value => setSkillForm(current => ({ ...current, isActive: value }))}
            label="Publish immediately"
          />
        </div>
      </CrmModal>

      <CrmModal
        open={Boolean(reviewing)}
        onClose={() => {
          if (!busy) setReviewing(null)
        }}
        title="Review profession submission"
        description={reviewing ? reviewing.requestedName : undefined}
        footer={
          <>
            <CrmButton variant="secondary" onClick={() => setReviewing(null)} disabled={Boolean(busy)}>
              Cancel
            </CrmButton>
            <CrmButton variant="primary" onClick={submitReview} disabled={Boolean(busy)}>
              {busy ? 'Saving...' : 'Complete review'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmField label="Decision">
            <select
              value={reviewForm.status}
              onChange={event => setReviewForm(current => ({ ...current, status: event.target.value }))}
              className={crmInputClass}
            >
              <option value="APPROVED">Approve against canonical profession</option>
              <option value="DUPLICATE">Mark duplicate</option>
              <option value="REJECTED">Reject</option>
            </select>
          </CrmField>

          {reviewForm.status !== 'REJECTED' && (
            <CrmField label="Canonical profession">
              <select
                value={reviewForm.canonicalProfessionId}
                onChange={event => setReviewForm(current => ({
                  ...current,
                  canonicalProfessionId: event.target.value,
                }))}
                className={crmInputClass}
              >
                <option value="">Select active profession</option>
                {professions.filter(item => item.isActive).map(item => (
                  <option key={item.id} value={item.id}>
                    {item.slug}
                  </option>
                ))}
              </select>
            </CrmField>
          )}

          <CrmField
            label="Review note"
            hint={reviewForm.status === 'REJECTED' ? 'Required for rejection.' : 'Optional audit note.'}
          >
            <textarea
              value={reviewForm.reviewNote}
              onChange={event => setReviewForm(current => ({ ...current, reviewNote: event.target.value }))}
              className={crmInputClass + ' h-auto min-h-[100px] resize-y py-2.5'}
              maxLength={2000}
            />
          </CrmField>
        </div>
      </CrmModal>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value.toLocaleString()}</div>
    </div>
  )
}

function PublishToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4">
      <div>
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">
          {disabled
            ? 'catalog:publish permission is required.'
            : 'If disabled, the record remains an inactive draft.'}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 accent-amber-500"
      />
    </label>
  )
}
