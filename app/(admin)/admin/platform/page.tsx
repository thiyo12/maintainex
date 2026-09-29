'use client'

import Link from 'next/link'
import {
  FiArrowUpRight,
  FiBell,
  FiGlobe,
  FiGrid,
  FiMonitor,
  FiSettings,
  FiShield,
  FiSliders,
  FiSmartphone,
  FiTag,
  FiUserCheck,
} from 'react-icons/fi'

interface PlatformCardProps {
  title: string
  description: string
  icon: any
  status: 'available' | 'planned'
  href?: string
  items: string[]
}

function PlatformCard({ title, description, icon: Icon, status, href, items }: PlatformCardProps) {
  const content = (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-[0_12px_36px_-28px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center">
          <Icon size={19} />
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${
          status === 'available'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          {status === 'available' ? 'Available now' : 'Planned module'}
        </span>
      </div>

      <h2 className="mt-5 font-semibold text-slate-950">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>

      <div className="mt-5 space-y-2">
        {items.map(item => (
          <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {item}
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {status === 'available' ? 'Open existing control surface' : 'Foundation reserved in CRM'}
        </span>
        {href && <FiArrowUpRight className="text-slate-400" size={16} />}
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

export default function PlatformManagementPage() {
  const modules: PlatformCardProps[] = [
    {
      title: 'Website management',
      description: 'Public-site content and growth controls will live here without mixing them into marketplace operations.',
      icon: FiMonitor,
      status: 'planned',
      items: ['Homepage & waitlist content', 'SEO and discoverability', 'Public banners and announcements'],
    },
    {
      title: 'Mobile app management',
      description: 'Operational app configuration for customer, tasker and company experiences.',
      icon: FiSmartphone,
      status: 'planned',
      items: ['Feature and market controls', 'Supported app configuration', 'Release and minimum-version controls'],
    },
    {
      title: 'Market & pricing',
      description: 'Existing country and pricing controls remain the canonical source while CRM management expands around them.',
      icon: FiSliders,
      status: 'available',
      href: '/admin/pricing/market-config',
      items: ['Country/market configuration', 'Pricing rules', 'Marketplace operating parameters'],
    },
    {
      title: 'Services & categories',
      description: 'Catalog operations will consolidate service/category administration and marketplace availability.',
      icon: FiGrid,
      status: 'planned',
      items: ['Service catalog', 'Category structure', 'Requirements and eligibility'],
    },
    {
      title: 'Offers & promotions',
      description: 'Campaign controls will bring existing seasonal and promotional mechanics into one CRM surface.',
      icon: FiTag,
      status: 'planned',
      items: ['Seasonal offers', 'Flash offers', 'Marketplace promotion visibility'],
    },
    {
      title: 'Notifications',
      description: 'A central operations surface for push, in-app and staff-facing notification management.',
      icon: FiBell,
      status: 'planned',
      items: ['Notification templates', 'Delivery visibility', 'Operational broadcasts'],
    },
    {
      title: 'Admins & staff',
      description: 'Existing staff administration remains available and will be expanded with clearer role and market assignment views.',
      icon: FiUserCheck,
      status: 'available',
      href: '/admin/admins',
      items: ['Admin accounts', 'Roles and access', 'Staff activity'],
    },
    {
      title: 'Platform settings',
      description: 'Existing configuration remains available while the CRM shell becomes the single operations entry point.',
      icon: FiSettings,
      status: 'available',
      href: '/admin/settings',
      items: ['Marketplace settings', 'Operational configuration', 'Administrative controls'],
    },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#10151d] text-white overflow-hidden">
        <div className="p-6 md:p-7 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-amber-300 font-semibold">
              <FiGlobe size={14} />
              Platform management
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
              Website, mobile app and marketplace controls
            </h1>
            <p className="mt-2 text-sm md:text-base leading-6 text-slate-400">
              This is the CRM control plane for MaintainEX product surfaces. Existing production controls stay canonical while each management module is migrated into the new workspace.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <FiShield className="text-emerald-300" size={18} />
            <div>
              <div className="text-sm font-medium">Production-safe migration</div>
              <div className="text-xs text-slate-500 mt-0.5">No public/mobile behavior changes in this phase</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Management modules</h2>
            <p className="text-sm text-slate-500 mt-1">Existing tools stay linked while new CRM surfaces are built phase by phase.</p>
          </div>
          <div className="text-xs text-slate-400">CRM Phase 1 foundation</div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {modules.map(module => <PlatformCard key={module.title} {...module} />)}
        </div>
      </section>
    </div>
  )
}
