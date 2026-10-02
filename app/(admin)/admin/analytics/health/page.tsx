'use client'

import { useCallback,useEffect,useState } from 'react'
import toast from 'react-hot-toast'
import { FiActivity,FiBell,FiClock,FiCreditCard,FiDatabase,FiRefreshCw } from 'react-icons/fi'
import { CrmBadge,CrmButton,CrmCard,CrmMetricCard,CrmPageHeader,CrmState } from '@/components/crm/v2/CrmPrimitives'

interface HealthData{
  status:string;release:string;checkedAt:string
  database:{status:string;latencyMs:number}
  queues:{jobMatchPending:number;offerMatchPending:number}
  payments:{pending:number;paypalConfigured:boolean;paypalWebhookConfigured:boolean;sandbox:boolean}
  notifications:{createdLastHour:number;expoPushAvailable:boolean;mediaStorageConfigured:boolean}
  cron:{configured:boolean}
}
export default function HealthPage(){
 const [data,setData]=useState<HealthData|null>(null);const[loading,setLoading]=useState(true)
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/admin/health',{credentials:'include',cache:'no-store'});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error||'Health unavailable');setData(b)}catch(e){toast.error(e instanceof Error?e.message:'Health unavailable')}finally{setLoading(false)}},[])
 useEffect(()=>{load()},[load])
 if(loading&&!data)return <CrmState type="loading" title="Checking system health" description="Checking safe application, database, queue and integration readiness."/>
 if(!data)return <CrmState type="error" title="System health unavailable" description="Health diagnostics could not be loaded." action={<CrmButton variant="secondary" onClick={load}>Retry</CrmButton>}/>
 return <div className="space-y-5">
  <CrmPageHeader eyebrow="Intelligence · Health" title="System health" description="Safe operational diagnostics only. Secret values, credentials and infrastructure access are never exposed." actions={<CrmButton variant="secondary" onClick={load}><FiRefreshCw size={14}/>Refresh</CrmButton>} context={<><CrmBadge tone={data.status==='healthy'?'success':'warning'} dot>{data.status.toUpperCase()}</CrmBadge><CrmBadge tone="neutral">Release · {data.release.slice(0,12)}</CrmBadge></>}/>
  <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
    <CrmMetricCard label="DB latency" value={`${data.database.latencyMs} ms`} icon={<FiDatabase/>} tone={data.database.latencyMs<500?'success':'warning'}/>
    <CrmMetricCard label="Job queue" value={data.queues.jobMatchPending.toLocaleString()} helper="Pending matches" icon={<FiActivity/>} tone="info"/>
    <CrmMetricCard label="Offer queue" value={data.queues.offerMatchPending.toLocaleString()} helper="Pending offers" icon={<FiClock/>} tone="amber"/>
    <CrmMetricCard label="Payment work" value={data.payments.pending.toLocaleString()} helper="Created/pending/refund processing" icon={<FiCreditCard/>} tone="warning"/>
    <CrmMetricCard label="Notifications / hour" value={data.notifications.createdLastHour.toLocaleString()} icon={<FiBell/>} tone="neutral"/>
  </section>
  <section className="grid gap-5 xl:grid-cols-3">
    <HealthCard title="Payment integration" rows={[['PayPal credentials',data.payments.paypalConfigured],['PayPal webhook',data.payments.paypalWebhookConfigured],[data.payments.sandbox?'Sandbox mode':'Live mode',true]]}/>
    <HealthCard title="Notification & media" rows={[['Expo push transport',data.notifications.expoPushAvailable],['Cloudinary media storage',data.notifications.mediaStorageConfigured]]}/>
    <HealthCard title="Scheduler readiness" rows={[['Cron authentication configured',data.cron.configured],['Database reachable',data.database.status==='healthy']]}/>
  </section>
  <CrmCard title="Diagnostic boundary" description="This workspace intentionally reports readiness booleans and counts only.">
    <p className="text-xs leading-6 text-slate-500">No environment variable values, API keys, secrets, database URLs, tokens, hostnames or private infrastructure addresses are returned by the health API.</p>
  </CrmCard>
 </div>
}
function HealthCard({title,rows}:{title:string;rows:Array<[string,boolean]>}){return <CrmCard title={title}><div className="space-y-2">{rows.map(([label,ok])=><div key={label} className="flex items-center justify-between rounded-xl border border-[var(--crm-border)] p-3"><span className="text-xs font-medium text-slate-700">{label}</span><CrmBadge tone={ok?'success':'warning'} dot>{ok?'READY':'NOT READY'}</CrmBadge></div>)}</div></CrmCard>}
