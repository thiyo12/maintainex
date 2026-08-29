# MaintainEX — App Structure & Processes (3 Profiles)

This document describes the full application structure and how the **Website (API)** and the **Mobile App** communicate for each of the three profiles: **Customer**, **Tasker**, and **Company**.

> Generated from the live codebase. Keep updated whenever routes, models, or flows change.

---

## 1. System Overview

| Layer | Tech | Location |
|---|---|---|
| Web + REST API | Next.js 14 (App Router, `app/api/**`) | `maintainex/` |
| Database | Prisma ORM — PostgreSQL (prod) / SQLite (dev) | `prisma/schema.prisma` |
| Mobile app | Expo / React Native (expo-router, TypeScript) | `maintainex/apps/mobile/` |
| Push notifications | Direct to Expo Push (`exp.host`) | server, `expo-notifications` on device |
| Deploy | Docker Swarm + Dokploy (Traefik) behind Cloudflare | Dokploy service `maintainex-mx-vcaohy` |
| Live site | https://maintainex.lk (mobile API base `https://maintainex.lk`) | |

**Roles.** One `User` account can act as more than one role (role-switch screen). The three mobile-facing roles are:

- **CUSTOMER** — posts jobs, picks providers, pays.
- **TASKER** — individual provider (profile, skills, KYC, quotes, jobs).
- **COMPANY** — company provider (team, quotes, contracts, milestones).

Plus a web-only **Admin panel** (`/admin`, 5–6 roles RBAC) — not part of the mobile app.

### Communication model (Mobile ⇄ Site/API)

```
 Mobile (Expo)                    Next.js API (maintainex.lk)          DB / Services
 ─────────────────────            ───────────────────────────          ─────────────
 lib/api.ts request()             JWT Bearer auth (30d)                 PostgreSQL
   ├─ fetch(`${EXPO_PUBLIC_API_URL}/api/mobile/...`)  →  lib/mobile-auth.ts
   │       (default https://maintainex.lk)             └─ authenticateRequest()
   │                                                    └─ assertNotSuspended()  (write routes)
   ├─ image URLs: lib/api.ts resolveImageUri()          →  public/uploads/** (avatars/products)
   └─ push: POST /api/mobile/notifications (token)      →  server POSTs to exp.host/push/send
```

- Every mobile API call goes through the `request()` helper in `apps/mobile/lib/api.ts` (attaches `Authorization: Bearer <JWT>`).
- All route handlers under `app/api/mobile/**` authenticate with `lib/mobile-auth.ts`; write endpoints must pass `assertNotSuspended(user)`.
- `EXPO_PUBLIC_API_URL` defaults to `https://maintainex.lk` (or `http://localhost:3000` in local dev).

---

## 2. Mobile App Structure

Expo Router directory groups: `apps/mobile/app/`

```
app/
├── (auth)/                         # welcome, login/OTP, register, role-switch
├── (chat)/                         # SHARED messaging (all roles)
│   ├── index.tsx                   #   inbox: list conversations, unread badges, 30s poll
│   ├── [id].tsx                    #   thread: send/receive, fraud banners, mark-read
│   └── _layout.tsx
├── notifications/index.tsx         # SHARED in-app notification list (mark read / mark all)
├── settings/                       # SHARED settings (edit-profile, payment, addresses,
│                                   #   help, about, terms, notifications screen)
├── (customer)/                     # CUSTOMER profile
├── (tasker)/                       # TASKER profile
├── (company)/                      # COMPANY profile
└── real-estate/                    # (sub-vertical, not role-bound)
```

Shared UI components: `components/chat/NewChatModal.tsx` (compose first message), `components/ProfileContent.tsx` (profile/settings hub menu), `components/ProfileHeader.tsx`, `components/offers/OfferProgramSection.tsx`, `components/find/TaskerCard.tsx`.

### 2.1 Customer profile — `app/(customer)/`

| Area | Screens | Purpose |
|---|---|---|
| **Tabs** `(tabs)/` | `index` (home), `explore` (services/categories), `inbox` (conversations → `(chat)`), `settings` (= `ProfileContent`) | Primary navigation |
| **Jobs v2** `jobs/v2/` | `create` (post a job), `[id]` (job detail, quotes, Nearby Heroes, Message buttons), `quotes/[id]`, `confirm/[id]` | Core hiring flow |
| **Find** `find/` | `index`, `taskers/[jobId]` (provider list + per-card Message button), `tasker-profile/[id]`, `booking`, `job` | Legacy template-job flow |
| **Other** | `booking`, `payment`, `wallet`, `tracking`, `jobs/complete`, `jobs/dispute`, `jobs/receipt`, `jobs/review` | Post-hire lifecycle |

### 2.2 Tasker profile — `app/(tasker)/`

| Area | Screens | Purpose |
|---|---|---|
| **Tabs** `(tabs)/` | `index` (Find Work grid), `my-jobs`, `earnings` (hidden tab, menu-only), `profile` | Primary navigation |
| **Jobs v2** `jobs/v2/` | `browse`/feed → `quote/[id]` (submit quote), `manage/[id]` (job control + **Message customer**) | Quote & deliver work |
| **Settings** `settings/` | `job-selection` (choose your services), `edit-profile`, `identity` (KYC) | Setup & verification |
| **Profile menu** | Earnings, **Messages** (unread badge), **Notifications** (unread badge), Your Services, My Profile | Account hub |

### 2.3 Company profile — `app/(company)/`

| Area | Screens | Purpose |
|---|---|---|
| **Tabs** `(tabs)/` | `index`, `contracts-list`, `milestones-list`, `earnings-list`, `team`, `profile` | Primary navigation |
| **Jobs v2** `jobs/v2/` | `browse` | Browse open jobs |
| **Team** `team/` | invite / accept, members | Manage workers |
| **Profile menu** | **Messages** (unread badge), **Notifications** (unread badge), My Profile | Account hub |

Company messaging = **inbox entry on profile menu** (reply to customer threads) + customers message companies from quote cards / provider cards. Company-initiated messaging to a contract client is not available because the legacy `Contract` model stores only `clientName` (no customer user id).

---

## 3. Website (API) Structure — `app/api/mobile/**`

| Group | Routes | Used by |
|---|---|---|
| `auth/` | send/verify OTP, register, login, me, profile, forgot/reset-password | all |
| `v2/jobs` | create, `[id]`, select-quote, escrow, otp, complete, cash-payment, reviews, share-address, release-escrow, workspace | customer/tasker/company |
| `v2/match/[jobId]` | matched providers (tasker + company) | matching |
| `v2/quotes` | create/accept quote (KYC-gated: `identityStatus === 'VERIFIED'`) | all providers |
| `v2/identity` | KYC status + upload | tasker |
| `v2/availability`, `v2/schedule` | provider availability | tasker |
| `v2/pricing` (+estimate/materials/confirm) | price estimation | customer |
| `v2/search`, `v2/locations`, `v2/subtasks`, `v2/quality`, `v2/trust`, `v2/wallet` | discovery & ops | all |
| `conversations/` | list/create, `[id]` thread + mark-read, `[id]/messages` (fraud-scanned + push) | all roles |
| `notifications/` | list, mark-read `[id]`, mark-all, register push token | all roles |
| `taskers/` | list, `[id]`, reviews, profile, status, location, skills (GET/PUT) | tasker/customer |
| `company/` | profile, contracts, milestones, earnings, team/invite, subscription | company |
| `upload/` and `files/` | avatar/product/document upload (public `public/uploads/**`) | all |
| `find-tasker`, `template-jobs`, `job-categories`, `service-categories`, `quick-bookings`, `seasonal-offers`, `search`, `disputes`, `earnings`, `withdraw`, `bookings`, `jobs` | legacy v1 flows | (deprecated paths) |
| `admin/*` (incl. `v2/admin/*`) | admin panel RBAC — commission-settle, escrows, identity review, jobs moderation, summary, alerts | web admin |

### Key data models (`prisma/schema.prisma`)

| Model | Notes |
|---|---|
| `User` | roles, `pushToken`, `identityStatus` (`NOT_SUBMITTED`…`APPROVED`), suspension/banned flags |
| `TaskerProfile` | `mxId` (MXT-…), bio, `hourlyRate`, skills, service areas, `verificationStatus`, rating |
| `CompanyProfile` | `mxId` (MXC-…), `companyName`, `registrationNo`, `taxId`, services, `isVerified`, logo |
| `MarketplaceJob` | `urgency` (normal/urgent/emergency), `workersCount`, `status` (OPEN→…→COMPLETED/CANCELLED), `currentWave` |
| `JobQuote` | `jobId`, `providerId`, `providerType` (**INDIVIDUAL** / **COMPANY**), `price`, `estimatedCompletionTime`, `status` (PENDING/ACCEPTED/REJECTED/WITHDRAWN) |
| `JobMatchQueue` / `OfferMatchQueue` | matching waves (`lib/job-matcher.ts`, `lib/matching-engine.ts`) |
| `JobEscrow` | deposit/release/refund + service-fee/commission settlement |
| `Conversation` / `ConversationParticipant` / `Message` | job-scoped dedup, `read` flags, `lastReadAt` |
| `Notification` | `title`, `body`, `data` (JSON), `read`, per-`userId` |
| `TaskerSkill` | service catalog + `experienceLevel` |
| `ProviderAvailability` | availability windows for matching |
| `IdentityDocument` | KYC submissions → admin review |
| `Contract` / `Milestone` | legacy v1 company contracts (clientName only) |
| `Dispute`, `Review`, `OfferProgram` | disputes, ratings, promo offers |

---

## 4. End-to-End Processes per Profile

### 4.1 Customer

1. **Auth** — send OTP → verify → login (JWT). Optionally role-switch.
2. **Post a job** — pick category/service → `jobs/v2/create` with budget, `urgency`, area, subtasks → `MarketplaceJob` status `OPEN`.
3. **Get matched providers** — matching engine (waves, `JobMatchQueue`) → `v2/match/[jobId]`; job detail shows **Nearby Heroes** + quotes.
4. **Message providers** — from quote card, provider card, or Find Taskers list → `NewChatModal` → `conversations.create` (job-scoped, deduplicated).
5. **Compare quotes** — providers send `JobQuote` (PENDING). Customer **selects a quote** → job `CONFIRMED` → escrow reference created.
6. **Job in progress** — OTP verify on arrival, workspace, shared address, optional cash payment, subtask progress.
7. **Pay / complete** — release escrow / cash-payment → status `COMPLETED` → review/rating → receipt (invoice) → notifications + push at each step.

### 4.2 Tasker

1. **Auth + role** — login → set up tasker profile: skills (tasker `skills` API + `experienceLevel`), bio, `hourlyRate`, avatar upload, service areas, phone.
2. **KYC** — submit `IdentityDocument` → admin reviews → `identityStatus`/`verificationStatus` must be **VERIFIED** to post quotes (API enforces).
3. **Find work** — home grid (Job Selection = Your Services) → open job feed → submit **quote** (price, estimated time, message).
4. **On acceptance** — `jobs/v2/manage/[id]`: message customer (button opens compose/thread), workspace, OTP, milestones, shared address.
5. **Earn** — complete → escrow release → **earnings / wallet** (menu & hidden tab) → withdraw.
6. **Availability & status** — `v2/availability`, `taskers/status` (online/offline) affect matching.

### 4.3 Company

1. **Auth + role** — register → company profile: `companyName`, `registrationNo`, `taxId`, services, logo; invite **team** members (`company/team/invite` → accept).
2. **Find jobs** — `jobs/v2/browse` (mobile) / web → submit **quote** with `providerType = COMPANY` (same verified-quote gating).
3. **Deliver via contracts** — active contracts list + **milestones** list (`company/contracts`, `company/milestones`) → progress tracking.
4. **Communicate** — profile menu **Messages** (inbox → `(chat)` thread replies) and **Notifications** (in-app list); customers reach the company from quote cards.
5. **Earn** — `earnings-list` (contract revenue) → escrow settlement / commission payouts (admin `commission-settle`).

---

## 5. Cross-Profile Communication

### 5.1 Messaging (all profiles)

- Channels are role-agnostic: `Conversation` ↔ `ConversationParticipant[]` ↔ `Message[]`, keyed by **userId**, so customer⇄tasker, customer⇄company, and tasker⇄customer use the same system.
- Identical UI: `components/chat/NewChatModal.tsx` (compose) + `app/(chat)/` (inbox + thread) + **inbox tab (customer)** / **Messages menu row (tasker, company)** with unread badges.
- Job-scoped dedup: creating a conversation for the same job + same pair returns the existing conversation.
- **Anti-cheat** (`lib/fraud-detection.ts`): every message scanned — contact/payment patterns are *replaced* (e.g. `[Contact details removed]`), never blocked; logs `SecurityAudit` + `FraudEvent` + threshold checks.
- **Safety limit**: 50 messages/conversation/day → HTTP 429.
- **Push**: server sends to recipient via raw `fetch` to `exp.host/--/api/v2/push/send` using `User.pushToken`; invalid/expired tokens are cleared.
- **Read tracking**: GET marks `read` + updates participant `lastReadAt`; unread totals drive badges and inbox poll (30s).

### 5.2 Notifications

- Written to DB (`Notification`) for job/quote/milestone/fraud/settlement events; **in-app list** at `/notifications` with mark-read + mark-all.
- Push tokens registered at app launch via `expo-notifications` → `POST /api/mobile/notifications`.
- Note: full foreground push requires a dev build (Expou Go SDK-53 limitation); DB list works anywhere.

### 5.3 Jobs, Matching & Payment

- One job pipeline regardless of provider type (`MarketplaceJob` + `JobQuote.providerType`).
- Matching: `lib/matching-engine.ts` (customers) + `lib/job-matcher.ts` (taskers, excludes unverified/suspended); waves via match queues.
- Payment: `JobEscrow` deposit → release/refund → service fee → commission settlement; cash-payment alternative; OTP verification protects job completion.

### 5.4 Gates, Safety & Admin

- Suspended/banned users: login blocked + every write route rejects via `assertNotSuspended()`.
- Quote creation requires KYC `VERIFIED`.
- Admin cares about all three profiles: identity review, job moderation (cancel/flag/refund), disputes, escrow settlement, work-queue alerts, security dashboards.

---

## 6. Model of a Single User Interaction

```
  Mobile screen                                API route                        Effect
 ─────────────────────────                  ───────────────────                ──────────
 "Message customer" (tasker manage)   →  conversations/[id]/messages POST  →  store Message
                                          lib/fraud-detection scan           flag/replace
                                          push → recipient (exp.host)        Notification to partner
 Inbox tab / Messages menu (30s)      →  conversations GET                   unread counts
 Thread open                          →  conversations/[id] GET              mark read + lastReadAt
 Notifications row                    →  notifications GET / PUT             list + mark read/all
```

---

## 7. Deployment & Local Dev Notes (summary)

- **Web/API deploy** (Dokploy): `find .next -name '._*' -delete` → swap `provider` to `postgresql` in schema → `tar` `.next` + package files → `docker cp` → `rm -rf /app/.next` in container → extract → `prisma generate` → `docker commit` → `docker service update --force` → revert schema to `sqlite` locally.
- **Schema push on prod** (e.g. new columns like `TaskerSkill.experienceLevel`): manually run `docker exec -it maintainex-mx-vcaohy npx prisma db push` after deploying the build.
- **Mobile**: Metro dev server on `localhost:8081` (currently running), iOS Simulator; check bundle via `.expo/.virtual-metro-entry.bundle?platform=ios` (expect HTTP 200).

## Appendix — Current Mobile ↔ API connection map (1:1)

| Feature | Helper (`apps/mobile/lib/api.ts`) | API route |
|---|---|---|
| Auth | `auth.*` | `/api/mobile/auth/*` |
| Jobs v2 | `jobs.*` | `/api/mobile/v2/jobs*, v2/match, v2/pricing*` |
| Matching | `match.*` | `/api/mobile/v2/match/[jobId]` |
| Quotes | `quotes.*` | `/api/mobile/v2/quotes` (+ select-quote) |
| Skills | `skillsApi.*` | `/api/mobile/taskers/skills` |
| Conversations | `conversations.*` | `/api/mobile/conversations/*` |
| Notifications | `notifications.*` | `/api/mobile/notifications*` |
| Tasker profile | `taskers.*` | `/api/mobile/taskers/*` |
| Company profile | `company.*` | `/api/mobile/company/*` |
| Uploads | `upload.file(kind)` + `resolveImageUri()` | `/api/mobile/upload`, `files` |