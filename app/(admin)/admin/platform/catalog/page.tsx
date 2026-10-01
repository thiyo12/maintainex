'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiGrid, FiPlus, FiRefreshCw, FiSearch, FiTool } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

type Tab='services'|'categories'|'templates'
interface Payload { categories:any[]; services:any[]; templates:any[]; jobCategories:any[] }

export default function CatalogManagementPage(){
  const {user}=useAdminSession()
  const role=(user?.role||'SUPPORT') as AdminRole
  const canEdit=(ROLE_PERMISSIONS[role]||[]).includes('settings:edit')
  const [data,setData]=useState<Payload>({categories:[],services:[],templates:[],jobCategories:[]})
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState<Tab>('services')
  const [query,setQuery]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [showCreate,setShowCreate]=useState(false)
  const [createType,setCreateType]=useState<'category'|'service'>('service')
  const [form,setForm]=useState<any>({name:'',description:'',countryCode:'LK',categoryId:'',price:'0',duration:'60',isActive:true})

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const r=await fetch('/api/admin/platform/catalog',{credentials:'include',cache:'no-store'})
      const b=await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(b?.error||'Unable to load catalog')
      setData(b)
    }catch(e){toast.error(e instanceof Error?e.message:'Failed to load catalog')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])

  const rows=useMemo(()=>{
    const list=tab==='services'?data.services:tab==='categories'?data.categories:data.templates
    const q=query.trim().toLowerCase()
    return q?list.filter((x:any)=>[x.name,x.slug,x.countryCode,x.category?.name,x.jobCategory?.name].some(v=>String(v||'').toLowerCase().includes(q))):list
  },[data,query,tab])

  async function toggle(type:'category'|'service'|'template',item:any){
    if(!canEdit) return
    setBusy(item.id)
    try{
      const r=await fetch('/api/admin/platform/catalog',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id:item.id,isActive:!item.isActive})})
      const b=await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(b?.error||'Update failed')
      toast.success(`${item.name} ${item.isActive?'deactivated':'activated'}`)
      await load()
    }catch(e){toast.error(e instanceof Error?e.message:'Update failed')}
    finally{setBusy(null)}
  }

  async function create(){
    if(!canEdit) return
    setBusy('create')
    try{
      const payload=createType==='category'
        ? {type:'category',name:form.name,description:form.description,countryCode:form.countryCode,isActive:form.isActive}
        : {type:'service',name:form.name,description:form.description,countryCode:form.countryCode,categoryId:form.categoryId,price:Number(form.price),duration:Number(form.duration),isActive:form.isActive}
      const r=await fetch('/api/admin/platform/catalog',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      const b=await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(b?.error||'Create failed')
      toast.success(createType==='category'?'Category created':'Service created')
      setShowCreate(false)
      setForm({name:'',description:'',countryCode:'LK',categoryId:'',price:'0',duration:'60',isActive:true})
      await load()
    }catch(e){toast.error(e instanceof Error?e.message:'Create failed')}
    finally{setBusy(null)}
  }

  if(loading) return <div className="h-[600px] rounded-2xl border border-slate-200 bg-white animate-pulse"/>

  return <div className="space-y-5">
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link href="/admin/platform" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><FiArrowLeft/> Platform management</Link>
        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Catalog operations</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Services & Categories</h1>
        <p className="mt-1.5 text-sm text-slate-500">Manage public website services and V2 marketplace service templates without destructive deletes.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={load} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-600"><FiRefreshCw/> Refresh</button>
        {canEdit&&<button onClick={()=>setShowCreate(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold"><FiPlus/> Create item</button>}
      </div>
    </section>

    <section className="grid grid-cols-3 gap-4">
      <Metric label="Website categories" value={data.categories.length}/>
      <Metric label="Website services" value={data.services.length}/>
      <Metric label="V2 service templates" value={data.templates.length}/>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          {(['services','categories','templates'] as Tab[]).map(t=><button key={t} onClick={()=>setTab(t)} className={`px-3 py-2 rounded-xl text-sm font-medium ${tab===t?'bg-slate-950 text-white':'bg-slate-50 text-slate-600'}`}>{t[0].toUpperCase()+t.slice(1)}</button>)}
        </div>
        <div className="relative md:w-80"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search catalog..." className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none"/></div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((item:any)=>{
          const type=tab==='services'?'service':tab==='categories'?'category':'template'
          return <div key={item.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">{tab==='categories'?<FiGrid/>:<FiTool/>}</div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                <div className="text-xs text-slate-400 mt-1 truncate">
                  {item.countryCode||'Multi-market'} · {item.category?.name||item.jobCategory?.name||item.slug||'—'}
                  {tab==='services'? ` · LKR ${item.price} · ${item.views} views`:''}
                  {tab==='templates'? ` · ${item.pricingMode?.replaceAll('_',' ')}`:''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] rounded-full border px-2 py-1 font-semibold ${item.isActive?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-slate-50 text-slate-500 border-slate-200'}`}>{item.isActive?'ACTIVE':'INACTIVE'}</span>
              {canEdit&&<button disabled={busy===item.id} onClick={()=>toggle(type as any,item)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{item.isActive?'Deactivate':'Activate'}</button>}
            </div>
          </div>
        })}
        {!rows.length&&<div className="py-16 text-center text-sm text-slate-400">No catalog entries match this view.</div>}
      </div>
    </section>

    {showCreate&&<div className="fixed inset-0 z-50 bg-slate-950/60 p-4 flex items-center justify-center" onClick={()=>setShowCreate(false)}>
      <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Create catalog item</h2><p className="text-xs text-slate-400 mt-1">Creation is permission-gated and audited.</p></div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">{(['service','category'] as const).map(t=><button key={t} onClick={()=>setCreateType(t)} className={`px-3 py-2 rounded-xl text-sm ${createType===t?'bg-slate-950 text-white':'bg-slate-100 text-slate-600'}`}>{t}</button>)}</div>
          <Input label="Name" value={form.name} onChange={(v)=>setForm((x:any)=>({...x,name:v}))}/>
          <Input label="Description" value={form.description} onChange={(v)=>setForm((x:any)=>({...x,description:v}))}/>
          <Input label="Country code" value={form.countryCode} onChange={(v)=>setForm((x:any)=>({...x,countryCode:v.toUpperCase()}))}/>
          {createType==='service'&&<>
            <label className="block"><span className="text-xs text-slate-600">Category</span><select value={form.categoryId} onChange={e=>setForm((x:any)=>({...x,categoryId:e.target.value}))} className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="">Select category</option>{data.categories.filter(c=>c.countryCode===form.countryCode).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3"><Input label="Price" value={String(form.price)} onChange={v=>setForm((x:any)=>({...x,price:v}))}/><Input label="Duration (min)" value={String(form.duration)} onChange={v=>setForm((x:any)=>({...x,duration:v}))}/></div>
          </>}
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={e=>setForm((x:any)=>({...x,isActive:e.target.checked}))} className="accent-amber-500"/> Active immediately</label>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button onClick={()=>setShowCreate(false)} className="h-10 px-4 rounded-xl border border-slate-200 text-sm">Cancel</button><button disabled={busy==='create'} onClick={create} className="h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold disabled:opacity-50">Create</button></div>
      </div>
    </div>}
  </div>
}

function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</div></div>}
function Input({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="block"><span className="text-xs text-slate-600">{label}</span><input value={value} onChange={e=>onChange(e.target.value)} className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-amber-300"/></label>}
