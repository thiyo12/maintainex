'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiCheckCircle, FiClock, FiRefreshCw, FiShield, FiUpload } from 'react-icons/fi'
import { CrmBadge, CrmButton, CrmPageHeader, CrmState, CrmTableFrame, crmInputClass, crmTdClass, crmThClass } from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

interface BankTransaction {
  id: string
  transactionId: string
  direction: string
  amountMinor: string
  currency: string
  countryCode: string
  reference: string
  reversalOfTransactionId?: string | null
  status: string
  mismatchCode?: string | null
  reconciliation?: { id: string; status: string; providerIdentityId: string; approvalRequestId?: string | null } | null
  reversalEvidence?: { id: string; status: string; approvalRequestId?: string | null; originalBankTransactionId: string } | null
}

interface BankStatementImport {
  id: string
  statementId: string
  accountRef: string
  countryCode: string
  currency: string
  rowCount: number
  provenanceType: string
  provenanceStatus: string
  verificationSource?: string | null
  verifiedAt?: string | null
  createdAt: string
  transactions: BankTransaction[]
}

function formatMinor(amount: string, currency: string) {
  const minor = BigInt(amount)
  return new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-LK', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(Number(minor) / 100)
}

export default function CommissionBankReconciliationPage() {
  const [imports, setImports] = useState<BankStatementImport[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statementId, setStatementId] = useState('')
  const [accountRef, setAccountRef] = useState('')
  const [countryCode, setCountryCode] = useState('LK')
  const [currency, setCurrency] = useState('LKR')
  const [file, setFile] = useState<File | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/financial/commission/bank-statements', {
        credentials: 'include', cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load bank statement queue')
      setImports(body.imports || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load bank statement queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function importStatement(event: React.FormEvent) {
    event.preventDefault()
    if (!file || submitting) return
    setSubmitting(true)
    try {
      if (file.size > 1_900_000) throw new Error('Statement JSON must be smaller than 1.9 MB')
      const parsed: unknown = JSON.parse(await file.text())
      const rows = Array.isArray(parsed) ? parsed : (parsed as { rows?: unknown })?.rows
      if (!Array.isArray(rows)) throw new Error('Statement JSON must contain a rows array')
      const response = await fetch('/api/admin/financial/commission/bank-statements', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId, accountRef, countryCode, currency, rows }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to import statement')
      toast.success('Statement imported and queued as unverified evidence')
      setStatementId(''); setAccountRef(''); setFile(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to import statement')
    } finally {
      setSubmitting(false)
    }
  }

  async function requestReconciliation(transaction: BankTransaction) {
    setActing(transaction.id)
    try {
      const isReversal = transaction.direction === 'DEBIT' && Boolean(transaction.reversalOfTransactionId)
      const actionPath = isReversal ? 'reverse' : 'reconcile'
      const response = await fetch(`/api/admin/financial/commission/bank-transactions/${encodeURIComponent(transaction.id)}/${actionPath}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({}),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to request reconciliation')
      toast.success(isReversal ? 'Bank reversal sent for maker-checker review' : 'Maker-checker approval requested')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to request reconciliation')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · Commission"
        title="Bank Reconciliation"
        description="Import normalized statement rows, verify source provenance, match the legal debtor and request a separate Finance approval before posting a balanced ledger recovery."
        actions={<>
          <Link href="/admin/approvals"><CrmButton variant="secondary"><FiShield size={14} />Approval queue</CrmButton></Link>
          <CrmButton variant="secondary" onClick={() => void load()} disabled={loading}><FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</CrmButton>
        </>}
      />
      <Link href="/admin/financial/commission" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700"><FiArrowLeft size={13} />Commission Control</Link>

      <CrmTableFrame title="Import bank statement" description="Accepted JSON contains statement metadata and normalized rows. The raw file is not retained. Import alone never proves receipt or changes a balance.">
        <form onSubmit={importStatement} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <input className={crmInputClass} value={statementId} onChange={e => setStatementId(e.target.value)} placeholder="Statement ID" required maxLength={200} aria-label="Statement ID" />
          <input className={crmInputClass} value={accountRef} onChange={e => setAccountRef(e.target.value)} placeholder="Configured account alias" required maxLength={100} aria-label="Configured account alias" />
          <select className={crmInputClass} value={countryCode} onChange={e => { setCountryCode(e.target.value); setCurrency(e.target.value === 'LK' ? 'LKR' : 'CAD') }} aria-label="Market">
            <option value="LK">Sri Lanka</option><option value="CA">Canada</option>
          </select>
          <input className={crmInputClass} value={currency} readOnly aria-label="Currency" />
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept="application/json,.json" onChange={e => setFile(e.target.files?.[0] || null)} aria-label="Statement JSON file" className="min-w-0 flex-1 text-xs" />
            <CrmButton type="submit" disabled={submitting || !file}><FiUpload size={14} />{submitting ? 'Importing…' : 'Import'}</CrmButton>
          </div>
        </form>
        <p className="px-4 pb-4 text-xs text-slate-500">Rows require transactionId, direction, amountMinor, currency, countryCode and reference. Include reversalOfTransactionId for a reversal. Use an account alias, never a full bank account number.</p>
      </CrmTableFrame>

      {loading ? <CrmState type="loading" title="Loading reconciliation queue" description="Loading market-scoped statement imports and transaction states." /> : imports.length === 0 ? (
        <CrmState type="empty" title="No bank statements imported" description="New imports appear here as unverified evidence until an authenticated source verifies their provenance." />
      ) : imports.map(statement => (
        <CrmTableFrame key={statement.id} title={`Statement ${statement.statementId}`} description={`${statement.accountRef} · ${statement.rowCount} rows · imported ${new Date(statement.createdAt).toLocaleString()}`}>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <CrmBadge tone={statement.provenanceStatus === 'VERIFIED' && statement.provenanceType === 'BANK_FEED' ? 'success' : 'warning'}>{statement.provenanceStatus === 'VERIFIED' && statement.provenanceType !== 'BANK_FEED' ? 'CALLBACK AUTHENTICATED ONLY' : statement.provenanceStatus}</CrmBadge>
            <span className="text-xs text-slate-500">{statement.countryCode} · {statement.currency}</span>
            {statement.verificationSource && <span className="text-xs text-slate-500">Source: {statement.verificationSource}</span>}
            {statement.verifiedAt && <span className="text-xs text-slate-500">Verified {new Date(statement.verifiedAt).toLocaleString()}</span>}
          </div>
          {statement.provenanceType !== 'BANK_FEED' && <p className="px-4 pb-3 text-xs text-amber-800">An HMAC-authenticated callback proves who sent the callback, not that funds moved. Only an approved bank-feed source can be used to reconcile.</p>}
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead><tr><th className={crmThClass}>Bank transaction</th><th className={crmThClass}>Direction</th><th className={crmThClass}>Reference</th><th className={crmThClass}>Amount</th><th className={crmThClass}>State</th><th className={`${crmThClass} text-right`}>Action</th></tr></thead>
              <tbody>{statement.transactions.map(transaction => <tr key={transaction.id}>
                <td className={crmTdClass}><div className="font-medium">{transaction.transactionId}</div><div className="text-xs text-slate-500">{transaction.id}</div></td>
                <td className={crmTdClass}>{transaction.direction}</td><td className={crmTdClass}>{transaction.reference}</td>
                <td className={crmTdClass}>{formatMinor(transaction.amountMinor, transaction.currency)}</td>
                <td className={crmTdClass}><span className="inline-flex items-center gap-1">{transaction.status === 'RECONCILED' ? <FiCheckCircle /> : <FiClock />}{transaction.reconciliation?.status || transaction.reversalEvidence?.status || transaction.status}{transaction.mismatchCode ? ` · ${transaction.mismatchCode}` : ''}</span>{transaction.direction === 'DEBIT' && transaction.reversalOfTransactionId && <div className="mt-1 text-[11px] text-slate-500">Reverses {transaction.reversalOfTransactionId}</div>}</td>
                <td className={`${crmTdClass} text-right`}>{transaction.status === 'UNREVIEWED' && statement.provenanceStatus === 'VERIFIED' && statement.provenanceType === 'BANK_FEED' && (transaction.direction === 'CREDIT' || Boolean(transaction.reversalOfTransactionId)) ? <CrmButton size="sm" variant="secondary" disabled={acting === transaction.id} onClick={() => void requestReconciliation(transaction)}>{acting === transaction.id ? 'Submitting…' : transaction.direction === 'DEBIT' ? 'Review reversal' : 'Request approval'}</CrmButton> : transaction.status === 'UNREVIEWED' && (statement.provenanceStatus !== 'VERIFIED' || statement.provenanceType !== 'BANK_FEED') ? <span className="text-xs text-amber-700">Awaiting approved bank-feed evidence</span> : transaction.direction === 'DEBIT' && !transaction.reversalOfTransactionId && transaction.status === 'UNREVIEWED' ? <span className="text-xs text-amber-700">Debit requires investigation</span> : transaction.reconciliation?.approvalRequestId || transaction.reversalEvidence?.approvalRequestId ? <Link className="text-xs font-semibold text-amber-800 hover:underline" href="/admin/approvals">Open approval request</Link> : null}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </CrmTableFrame>
      ))}
    </div>
  )
}
