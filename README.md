# MaintainEX — Marketplace & Launch Website

MaintainEX is a marketplace connecting customers, taskers and companies with professional help for personal, business and local tasks.

- Current public website: https://maintainex.lk/
- Canada website: https://ca.maintainex.lk/
- Public experience: marketplace landing page and early-access waitlist.
- Launch status: join the waitlist; do not advertise legacy web bookings as active.
- Pricing: service quotes are set by professionals through the marketplace. Do not publish old fixed service prices from the V1 web catalog as current offers.

## Current code

| Purpose | Location |
| --- | --- |
| Marketplace homepage | `app/(public)/home/client.tsx` |
| Homepage route | `app/(public)/page.tsx` |
| Waitlist | `app/(public)/waitlist/` |
| Admin/CRM | `app/(admin)/` and `app/api/admin/` |
| Mobile app | `apps/mobile/` |
| Canonical V2 catalog | `JobCategory`, `TemplateJob`, `ServiceTemplate`; `app/api/mobile/` |
| Canonical marketplace pricing | `lib/pricing/` |
| Regional runtime controls | `lib/runtime/platform-runtime.ts` |

## Retired public services pages

The old `/services` pages, their service-specific price metadata and city SEO pages are retired. Requests to `/services` and all descendant URLs redirect to the new marketplace home page's features section.

**Important:** The older V1 `Category`/`Service` database catalog and supporting API remain for compatibility with existing administrative/legacy data flows. Do not delete the database tables, historical records, or `lib/pricing/` while active dependencies remain. Old database seeding must not be reintroduced into the public site.

## Local development

Requirements: Node.js 18+, npm, appropriate environment variables and a development database.

```bash
npm install
npm run dev
```

The Next.js app uses port 3000 by default. For mobile development, use `npm run dev:mobile`.

To check before deployment:

```bash
npm run build
npm test -- --run
```

Never run destructive Prisma reset or development migrations against production. Production migrations use `npx prisma migrate deploy` with an approved backup and rollout.

## Deployment / architecture

For deployment details see `DOKPLOY_SETUP.md`, `docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md`, and `docs/architecture/`.
For legacy retirement safety and dependency requirements see `docs/architecture/restructure/legacy-retirement.md`.
