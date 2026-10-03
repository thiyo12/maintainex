'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiAlertTriangle,FiLock,FiPlus,FiRefreshCw,FiShield,FiUserX,FiWifi } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,CrmButton,CrmCard,CrmField,CrmMetricCard,CrmPageHeader,CrmState,CrmTableFrame,
  crmInputClass,crmTableClass,crmTdClass,crmThClass,type CrmTone
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

interface SecurityData{
  summary:{totalEventsToday:number;blockedIPs:number;failedLogins:number;highRiskEvents:number;activeSessions:number;apiRequestsLastHour:number}
  recentEvents:Array<{id:string;action:string;category:string;userId?:string|null;riskLevel:string;ipAddress?:string|null;description:string;createdAt:string}>
  blockedIPs:Array<{ip:string;reason:string;blockedAt:string;expiresAt:string}>
  topThreats:Array<{ip:string;attempts:number;riskLevel:string;reason:string}>
  credentialStuffs:Array<{ip:string;uniqueEmails:number;riskLevel:string}>
  botsDetected:Array<{ip:string;intervalVariance:number;requestCount:number}>
  riskDistribution:Record<string,number>
}

export default function SecurityMonitorPage(){
  const {user}=useAdminSession()
  const canManage=Boolean(user?.permissions?.includes('security:audit'))
  const [data,setData]=useState<SecurityData|null>(null)
  const [loading,setLoading]=useState(true)
  const [modal,setModal]=useState(false)
  const [ip,setIp]=useState('')
  const [reason,setReason]=useState('')
  const [duration,setDuration]=useState('360')
  const [busy,setBusy]=useState(false)

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const response=await fetch('/api/admin/security/monitor',{credentials:'include',cache:'no-store'})
      const body=await response.json().catch(()=>({}))
      if(!response.ok) crmApiError(body, 'Unable to load security monitor')
      setData(body)
    }catch(error){toast.error(error instanceof Error?error.message:'Failed to load security monitor')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  async function blockIp(){
    if(!canManage||!ip.trim()||reason.trim().length<3) return
    setBusy(true)
    try{
      const response=await fetch('/api/admin/security/blocked-ips',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:ip.trim(),reason:reason.trim(),durationMinutes:duration?Number(duration):null})})
      const body=await response.json().catch(()=>({}))
      if(!response.ok) crmApiError(body, 'Unable to block IP')
      toast.success('IP block applied');setModal(false);setIp('');setReason('');await load()
    }catch(error){toast.error(error instanceof Error?error.message:'Unable to block IP')}finally{setBusy(false)}
  }
  async function unblockIp(value:string){
    if(!canManage) return
    const response=await fetch('/api/admin/security/blocked-ips',{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:value})})
    const body=await response.json().catch(()=>({}))
    if(!response.ok){toast.error(body?.error||'Unable to unblock IP');return}
    toast.success('IP block removed');await load()
  }

  if(loading&&!data) return <CrmState type="loading" title="Loading security monitor" description="Loading failed-login, session, threat and security-audit signals."/>
  if(!data) return <CrmState type="error" title="Security monitor unavailable" description="Security data could not be loaded." action={<CrmButton variant="secondary" onClick={load}>Retry</CrmButton>}/>

  return <div className="space-y-4">
    <CrmPageHeader eyebrow="Intelligence · Security" title="Security monitor" description="Operational security signals with guarded IP controls and audit-backed mutations."
      actions={<><CrmButton variant="secondary" onClick={load}><FiRefreshCw size={14}/>Refresh</CrmButton>{canManage&&<CrmButton variant="primary" onClick={()=>setModal(true)}><FiPlus size={14}/>Block IP</CrmButton>}</>}
      context={<><CrmBadge tone="success" dot>Live security data</CrmBadge><CrmBadge tone={canManage?'warning':'neutral'}>{canManage?'Sensitive controls enabled':'Read-only'}</CrmBadge></>}/>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      <CrmMetricCard label="Events today" value={data.summary.totalEventsToday.toLocaleString()} icon={<FiShield/>} tone="info"/>
      <CrmMetricCard label="Blocked IPs" value={data.summary.blockedIPs.toLocaleString()} icon={<FiLock/>} tone="warning"/>
      <CrmMetricCard label="Failed logins" value={data.summary.failedLogins.toLocaleString()} icon={<FiUserX/>} tone={data.summary.failedLogins>10?'danger':'warning'}/>
      <CrmMetricCard label="High risk" value={data.summary.highRiskEvents.toLocaleString()} icon={<FiAlertTriangle/>} tone={data.summary.highRiskEvents>0?'danger':'neutral'}/>
      <CrmMetricCard label="User sessions" value={data.summary.activeSessions.toLocaleString()} icon={<FiWifi/>} tone="success"/>
      <CrmMetricCard label="API req / hour" value={data.summary.apiRequestsLastHour.toLocaleString()} helper="Rate-limit telemetry" tone="neutral"/>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <CrmTableFrame title="Recent security events" description="High-risk events and suspicious activity are retained in the security audit.">
        <table className={`${crmTableClass} min-w-[780px]`}><thead><tr><th className={crmThClass}>Time</th><th className={crmThClass}>Action</th><th className={crmThClass}>Risk</th><th className={crmThClass}>Description</th><th className={crmThClass}>Source</th></tr></thead>
          <tbody>{data.recentEvents.length===0?<tr><td colSpan={5} className={`${crmTdClass} text-center text-slate-400`}>No recent security events.</td></tr>:data.recentEvents.map(e=><tr key={e.id}><td className={crmTdClass}><span className="text-xs text-slate-600">{fmt(e.createdAt)}</span></td><td className={crmTdClass}><span className="text-xs font-semibold text-slate-800">{e.action}</span></td><td className={crmTdClass}><CrmBadge tone={riskTone(e.riskLevel)}>{e.riskLevel}</CrmBadge></td><td className={crmTdClass}><div className="max-w-[320px] truncate text-xs text-slate-600">{e.description}</div></td><td className={crmTdClass}><span className="font-mono text-[11px] text-slate-400">{maskIp(e.ipAddress)}</span></td></tr>)}</tbody>
        </table>
      </CrmTableFrame>

      <CrmCard title="Risk distribution" description="Security audit risk classification for today.">
        <div className="space-y-3">{Object.entries(data.riskDistribution).map(([level,count])=><div key={level} className="flex items-center justify-between rounded-[10px] border border-[var(--crm-border)] bg-[#fbfcfd] p-3"><CrmBadge tone={riskTone(level)}>{level}</CrmBadge><span className="text-lg font-semibold text-slate-900">{count.toLocaleString()}</span></div>)}</div>
      </CrmCard>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <CrmTableFrame title="Blocked IPs" description="Only authorized security operators can change this list.">
        <table className={`${crmTableClass} min-w-[680px]`}><thead><tr><th className={crmThClass}>IP</th><th className={crmThClass}>Reason</th><th className={crmThClass}>Expires</th><th className={crmThClass}>Control</th></tr></thead>
          <tbody>{data.blockedIPs.length===0?<tr><td colSpan={4} className={`${crmTdClass} text-center text-slate-400`}>No active IP blocks.</td></tr>:data.blockedIPs.map(b=><tr key={b.ip}><td className={crmTdClass}><span className="font-mono text-xs text-slate-700">{b.ip}</span></td><td className={crmTdClass}><div className="max-w-[280px] truncate text-xs text-slate-600">{b.reason}</div></td><td className={crmTdClass}><span className="text-xs text-slate-500">{fmt(b.expiresAt)}</span></td><td className={crmTdClass}>{canManage?<CrmButton size="sm" variant="secondary" onClick={()=>unblockIp(b.ip)}>Unblock</CrmButton>:<span className="text-xs text-slate-400">View only</span>}</td></tr>)}</tbody>
        </table>
      </CrmTableFrame>

      <CrmCard title="Threat signals" description="Aggregated failed-login and credential-stuffing indicators; no credential values are exposed.">
        <div className="space-y-2">
          {data.topThreats.slice(0,8).map(t=><div key={t.ip} className="flex items-center justify-between rounded-[10px] border border-[var(--crm-border)] bg-[#fbfcfd] p-3"><div><div className="font-mono text-xs text-slate-700">{maskIp(t.ip)}</div><div className="mt-1 text-[10px] text-slate-400">{t.attempts} attempts · {t.reason}</div></div><CrmBadge tone={riskTone(t.riskLevel)}>{t.riskLevel}</CrmBadge></div>)}
          {data.credentialStuffs.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{data.credentialStuffs.length} credential-stuffing patterns detected in the last hour.</div>}
          {data.botsDetected.length>0&&<div className="rounded-xl border border-[var(--crm-border)] bg-slate-50 p-3 text-xs text-slate-600">{data.botsDetected.length} regular-interval bot patterns detected today.</div>}
        </div>
      </CrmCard>
    </section>

    <CrmModal open={modal} onClose={()=>{if(!busy)setModal(false)}} title="Block IP address" description="This is a sensitive audited security action." footer={<><CrmButton variant="secondary" disabled={busy} onClick={()=>setModal(false)}>Cancel</CrmButton><CrmButton variant="danger" disabled={busy||!ip.trim()||reason.trim().length<3} onClick={blockIp}>{busy?'Blocking…':'Block IP'}</CrmButton></>}>
      <div className="space-y-4"><CrmField label="IP address"><input value={ip} onChange={e=>setIp(e.target.value)} className={crmInputClass} placeholder="203.0.113.10"/></CrmField><CrmField label="Reason"><textarea value={reason} onChange={e=>setReason(e.target.value)} className={`${crmInputClass} h-auto min-h-[96px] py-2.5`} maxLength={1000}/></CrmField><CrmField label="Duration"><select value={duration} onChange={e=>setDuration(e.target.value)} className={crmInputClass}><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">24 hours</option><option value="10080">7 days</option><option value="">Long-term</option></select></CrmField></div>
    </CrmModal>
  </div>
}

function riskTone(level:string):CrmTone{if(level==='CRITICAL'||level==='HIGH')return'danger';if(level==='MEDIUM')return'warning';return'success'}
function fmt(v:string){return new Date(v).toLocaleString('en-LK',{dateStyle:'medium',timeStyle:'short'})}
function maskIp(v?:string|null){if(!v)return'—';const p=v.split('.');return p.length===4?`${p[0]}.${p[1]}.*.*`:'masked'}
