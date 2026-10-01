'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiClock, FiPlus, FiRefreshCw, FiTag, FiZap } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface Payload { seasonal:any[]; flash:any[]; canManageGlobalFlash:boolean }

export default function OffersManagementPage(){
  const {user}=useAdminSession()
  const role=(user?.role||'SUPPORT') as AdminRole
  const canEdit=(ROLE_PERMISSIONS[role]||[]).includes('settings:edit')
  const [data,setData]=useState<Payload>({seasonal:[],flash:[],canManageGlobalFlash:false})
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState<string|null>(null)
  const [show,setShow]=useState(false)
  const [type,setType]=useState<'seasonal'|'flash'>('seasonal')
  const [form,setForm]=useState<any>({title:'',description:'',season:'general',country:'LK',discountType:'PERCENTAGE',discountValue:'10',startsAt:'',expiresAt:'',isActive:true})

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const r=await fetch('/api/admin/platform/offers',{credentials:'include',cache:'no-store'})
      const b=await r.json().catch(()=>({}))
      if(!r.ok)throw new Error(b?.error||'Unable to load offers')
      setData(b)
    }catch(e){toast.error(e instanceof Error?e.message:'Failed to load offers')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  async function toggle(kind:'seasonal'|'flash',item:any){
    setBusy(item.id)
    try{
      const r=await fetch('/api/admin/platform/offers',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:kind,id:item.id,isActive:!item.isActive})})
      const b=await r.json().catch(()=>({}))
      if(!r.ok)throw new Error(b?.error||'Update failed')
      toast.success(`${item.title} ${item.isActive?'deactivated':'activated'}`)
      await load()
    }catch(e){toast.error(e instanceof Error?e.message:'Update failed')}
    finally{setBusy(null)}
  }

  async function create(){
    setBusy('create')
    try{
      const payload=type==='seasonal'
        ? {type,title:form.title,description:form.description,season:form.season,country:form.country,isActive:form.isActive}
        : {type,title:form.title,description:form.description,discountType:form.discountType,discountValue:Number(form.discountValue),startsAt:form.startsAt,expiresAt:form.expiresAt,isActive:form.isActive}
      const r=await fetch('/api/admin/platform/offers',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      const b=await r.json().catch(()=>({}))
      if(!r.ok)throw new Error(b?.error||'Create failed')
      toast.success('Offer created')
      setShow(false)
      setForm({title:'',description:'',season:'general',country:'LK',discountType:'PERCENTAGE',discountValue:'10',startsAt:'',expiresAt:'',isActive:true})
      await load()
    }catch(e){toast.error(e instanceof Error?e.message:'Create failed')}
    finally{setBusy(null)}
  }

  if(loading)return <div className="h-[560px] rounded-2xl border border-slate-200 bg-white animate-pulse"/>

  return <div className="space-y-5">
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><Link href="/admin/platform" className="inline-flex items-center gap-2 text-sm text-slate-500"><FiArrowLeft/> Platform management</Link><div className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Campaign operations</div><h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Offers & Promotions</h1><p className="mt-1.5 text-sm text-slate-500">Manage real seasonal and flash promotion records used by MaintainEX.</p></div>
      <div className="flex gap-2"><button onClick={load} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm inline-flex items-center gap-2"><FiRefreshCw/> Refresh</button>{canEdit&&<button onClick={()=>setShow(true)} className="h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold inline-flex items-center gap-2"><FiPlus/> New offer</button>}</div>
    </section>

    <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <Metric label="Seasonal offers" value={data.seasonal.length}/>
      <Metric label="Active seasonal" value={data.seasonal.filter(x=>x.isActive).length}/>
      <Metric label="Flash offers" value={data.flash.length}/>
      <Metric label="Active flash" value={data.flash.filter(x=>x.isActive&&new Date(x.expiresAt)>new Date()).length}/>
    </section>

    <div className="grid xl:grid-cols-2 gap-5">
      <Panel title="Seasonal offers" icon={FiTag}>
        {data.seasonal.length?data.seasonal.map(item=><OfferRow key={item.id} item={item} meta={`${item.country} · ${item.season} · ${item._count?.jobs||0} jobs`} canEdit={canEdit} busy={busy===item.id} onToggle={()=>toggle('seasonal',item)}/>):<Empty/>}
      </Panel>
      <Panel title="Flash offers" icon={FiZap}>
        {data.flash.length?data.flash.map(item=><OfferRow key={item.id} item={item} meta={`${item.discountType} ${item.discountValue} · expires ${date(item.expiresAt)}`} canEdit={canEdit&&data.canManageGlobalFlash} busy={busy===item.id} onToggle={()=>toggle('flash',item)}/>):<Empty/>}
        {!data.canManageGlobalFlash&&<div className="mt-3 text-xs text-slate-400">Global flash offers are visible but only SUPER_ADMIN can modify them.</div>}
      </Panel>
    </div>

    {show&&<div className="fixed inset-0 z-50 bg-slate-950/60 p-4 flex items-center justify-center" onClick={()=>setShow(false)}><div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl" onClick={e=>e.stopPropagation()}>
      <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Create offer</h2><p className="text-xs text-slate-400 mt-1">This action is rate-limited and audited.</p></div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2"><button onClick={()=>setType('seasonal')} className={`px-3 py-2 rounded-xl text-sm ${type==='seasonal'?'bg-slate-950 text-white':'bg-slate-100'}`}>Seasonal</button>{data.canManageGlobalFlash&&<button onClick={()=>setType('flash')} className={`px-3 py-2 rounded-xl text-sm ${type==='flash'?'bg-slate-950 text-white':'bg-slate-100'}`}>Flash</button>}</div>
        <Input label="Title" value={form.title} onChange={v=>setForm((x:any)=>({...x,title:v}))}/><Input label="Description" value={form.description} onChange={v=>setForm((x:any)=>({...x,description:v}))}/>
        {type==='seasonal'?<div className="grid grid-cols-2 gap-3"><Select label="Season" value={form.season} options={['general','spring','summer','fall','winter']} onChange={v=>setForm((x:any)=>({...x,season:v}))}/><Input label="Country" value={form.country} onChange={v=>setForm((x:any)=>({...x,country:v.toUpperCase()}))}/></div>:<>
          <div className="grid grid-cols-2 gap-3"><Select label="Discount type" value={form.discountType} options={['PERCENTAGE','FLAT']} onChange={v=>setForm((x:any)=>({...x,discountType:v}))}/><Input label="Discount value" value={form.discountValue} onChange={v=>setForm((x:any)=>({...x,discountValue:v}))}/></div>
          <div className="grid grid-cols-2 gap-3"><Input label="Starts at (ISO/date)" value={form.startsAt} onChange={v=>setForm((x:any)=>({...x,startsAt:v}))}/><Input label="Expires at (ISO/date)" value={form.expiresAt} onChange={v=>setForm((x:any)=>({...x,expiresAt:v}))}/></div>
        </>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e=>setForm((x:any)=>({...x,isActive:e.target.checked}))} className="accent-amber-500"/> Active immediately</label>
      </div>
      <div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button onClick={()=>setShow(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-sm">Cancel</button><button disabled={busy==='create'} onClick={create} className="h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold disabled:opacity-50">Create</button></div>
    </div></div>}
  </div>
}

function date(v:string){return new Date(v).toLocaleDateString('en-LK')}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>}
function Panel({title,icon:Icon,children}:{title:string;icon:any;children:React.ReactNode}){return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Icon className="text-amber-600"/><h2 className="font-semibold text-slate-900">{title}</h2></div><div className="mt-4 space-y-2">{children}</div></section>}
function OfferRow({item,meta,canEdit,busy,onToggle}:{item:any;meta:string;canEdit:boolean;busy:boolean;onToggle:()=>void}){return <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4"><div><div className="font-medium text-slate-800">{item.title}</div><div className="text-xs text-slate-400 mt-1">{meta}</div></div><div className="flex items-center gap-2"><span className={`text-[10px] px-2 py-1 rounded-full border ${item.isActive?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-slate-50 text-slate-500 border-slate-200'}`}>{item.isActive?'ACTIVE':'INACTIVE'}</span>{canEdit&&<button disabled={busy} onClick={onToggle} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-50">{item.isActive?'Deactivate':'Activate'}</button>}</div></div>}
function Empty(){return <div className="py-8 text-center text-sm text-slate-400"><FiClock className="mx-auto mb-2"/>No offers in this group.</div>}
function Input({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="block"><span className="text-xs text-slate-600">{label}</span><input value={value} onChange={e=>onChange(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"/></label>}
function Select({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}){return <label className="block"><span className="text-xs text-slate-600">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">{options.map(o=><option key={o}>{o}</option>)}</select></label>}
