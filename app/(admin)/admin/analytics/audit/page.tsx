'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiChevronDown, FiChevronUp, FiRefreshCw, FiSearch } from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmFilterBar,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

interface AuditLog {
  id: string
  adminUserId: string
  adminEmail: string
  adminRole: string
  action: string
  targetTable?: string | null
  targetId?: string | null
  targetLabel?: string | null
  oldValue?: string | null
  newValue?: string | null
  ipAddress: string
  createdAt: string
}

export default function AuditLogPage() {
  const [logs,setLogs]=useState<AuditLog[]>([])
  const [loading,setLoading]=useState(true)
  const [page,setPage]=useState(1)
  const [total,setTotal]=useState(0)
  const [totalPages,setTotalPages]=useState(1)
  const [scope,setScope]=useState('')
  const [expanded,setExpanded]=useState<string|null>(null)
  const [action,setAction]=useState('')
  const [adminUserId,setAdminUserId]=useState('')
  const [target,setTarget]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const params=new URLSearchParams({page:String(page),pageSize:'50'})
      if(action.trim()) params.set('action',action.trim())
      if(adminUserId.trim()) params.set('adminUserId',adminUserId.trim())
      if(target.trim()) params.set('targetId',target.trim())
      const response=await fetch(`/api/admin/audit?${params}`,{credentials:'include',cache:'no-store'})
      const body=await response.json().catch(()=>({}))
      if(!response.ok) crmApiError(body, 'Unable to load audit')
      setLogs(body.logs||[])
      setTotal(body.total||0)
      setTotalPages(body.totalPages||1)
      setScope(body.scope||'')
    }catch(error){
      toast.error(error instanceof Error?error.message:'Failed to load audit')
    }finally{setLoading(false)}
  },[action,adminUserId,page,target])

  useEffect(()=>{load()},[load])

  if(loading&&logs.length===0){
    return <CrmState type="loading" title="Loading audit history" description="Reading immutable operator audit entries."/>
  }

  return <div className="space-y-4">
    <CrmPageHeader
      eyebrow="Intelligence · Audit"
      title="Audit history"
      description="Immutable CRM operator history with server-side secret redaction and permission-aware scope."
      actions={<CrmButton variant="secondary" onClick={load}><FiRefreshCw size={14}/>Refresh</CrmButton>}
      context={<><CrmBadge tone="success" dot>Immutable history</CrmBadge><CrmBadge tone="info">{scope||'Scoped'}</CrmBadge><CrmBadge tone="neutral">{total.toLocaleString()} entries</CrmBadge></>}
    />

    <CrmFilterBar>
      <div className="relative min-w-0 flex-1">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
        <input value={action} onChange={e=>{setAction(e.target.value);setPage(1)}} className={`${crmInputClass} pl-9`} placeholder="Action e.g. PROPERTY_APPROVE"/>
      </div>
      <input value={adminUserId} onChange={e=>{setAdminUserId(e.target.value);setPage(1)}} className={`${crmInputClass} md:w-[220px]`} placeholder="Admin ID"/>
      <input value={target} onChange={e=>{setTarget(e.target.value);setPage(1)}} className={`${crmInputClass} md:w-[220px]`} placeholder="Target ID"/>
    </CrmFilterBar>

    <CrmTableFrame title="Operator audit" description="Old/new values are redacted by the server before this page receives them.">
      <table className={`${crmTableClass} min-w-[1100px]`}>
        <thead><tr>
          <th className={crmThClass}>Time</th><th className={crmThClass}>Operator</th><th className={crmThClass}>Action</th>
          <th className={crmThClass}>Target</th><th className={crmThClass}>Source</th><th className={crmThClass}>Details</th>
        </tr></thead>
        <tbody>
          {logs.length===0?<tr><td colSpan={6} className={`${crmTdClass} text-center text-slate-400`}>No audit entries match this filter.</td></tr>:
          logs.map(log=><>
            <tr key={log.id}>
              <td className={crmTdClass}><span className="text-xs text-slate-600">{formatDate(log.createdAt)}</span></td>
              <td className={crmTdClass}><div className="text-xs font-semibold text-slate-800">{log.adminEmail}</div><div className="mt-0.5 text-[10px] text-slate-400">{log.adminRole}</div></td>
              <td className={crmTdClass}><CrmBadge tone={auditTone(log.action)}>{log.action}</CrmBadge></td>
              <td className={crmTdClass}><div className="max-w-[260px] truncate text-xs text-slate-700">{log.targetLabel||log.targetId||'—'}</div><div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-400">{log.targetTable||'—'}</div></td>
              <td className={crmTdClass}><span className="font-mono text-[11px] text-slate-500">{maskIp(log.ipAddress)}</span></td>
              <td className={crmTdClass}>{(log.oldValue||log.newValue)?<CrmButton size="sm" variant="ghost" onClick={()=>setExpanded(expanded===log.id?null:log.id)}>{expanded===log.id?<FiChevronUp/>:<FiChevronDown/>}{expanded===log.id?'Hide':'View'}</CrmButton>:<span className="text-xs text-slate-400">—</span>}</td>
            </tr>
            {expanded===log.id&&<tr key={`${log.id}-detail`}><td colSpan={6} className="border-b border-[var(--crm-border)] bg-[#fafbf9] px-4 py-4">
              <div className="grid gap-3.5 lg:grid-cols-2">
                <AuditValue title="Previous" value={log.oldValue}/><AuditValue title="New" value={log.newValue}/>
              </div>
            </td></tr>}
          </>)}
        </tbody>
      </table>
    </CrmTableFrame>

    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <CrmButton size="sm" variant="secondary" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</CrmButton>
        <CrmButton size="sm" variant="secondary" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</CrmButton>
      </div>
    </div>
  </div>
}

function AuditValue({title,value}:{title:string;value?:string|null}){
  return <div className="rounded-xl border border-[var(--crm-border)] bg-white p-3"><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{title}</div><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-600">{value||'—'}</pre></div>
}
function auditTone(action:string):CrmTone{
  if(/REJECT|DELETE|BAN|SUSPEND|REVOKE|FAIL/i.test(action)) return 'danger'
  if(/APPROVE|CREATE|UNBAN|UNSUSPEND|SUCCESS/i.test(action)) return 'success'
  if(/UPDATE|CHANGE|SETTINGS|ASSIGN/i.test(action)) return 'warning'
  return 'neutral'
}
function formatDate(value:string){return new Date(value).toLocaleString('en-LK',{dateStyle:'medium',timeStyle:'short'})}
function maskIp(value:string){const p=value?.split('.')||[];return p.length===4?`${p[0]}.${p[1]}.*.*`:(value?'masked':'—')}
