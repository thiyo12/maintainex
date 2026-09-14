# MaintainEX Architecture

**Version**: 1.0
**Last Updated**: 2026-09-14
**Status**: Living Document

---

## Overview

MaintainEX is a two-sided marketplace connecting customers with home services providers (individual taskers and companies). The platform handles job posting, provider matching, quoting, escrow-based payments, dispute resolution, and commission settlement.

This directory contains architecture documentation following the C4 model and documenting cross-cutting concerns.

---

## Table of Contents

| Document | Description |
|---|---|
| [system-context.md](./system-context.md) | C4 System Context — actors, boundaries, external integrations |
| [container.md](./container.md) | C4 Container — services, databases, runtime topology |
| [component-admin.md](./component-admin.md) | Admin panel component structure and RBAC |
| [component-mobile.md](./component-mobile.md) | Mobile app component architecture |
| [component-marketplace-api.md](./component-marketplace-api.md) | Marketplace API routes and middleware chain |
| [data-model.md](./data-model.md) | Core domain models, relationships, enums |
| [authentication.md](./authentication.md) | Auth architecture: JWT, OTP, sessions, RBAC |
| [matching-engine.md](./matching-engine.md) | Provider matching: scoring, waves, eligibility, fairness |
| [pricing-engine.md](./pricing-engine.md) | Pricing: classification, templates, surge, country config |
| [financial-ledger.md](./financial-ledger.md) | Double-entry ledger, escrow lifecycle, settlement |
| [security-layers.md](./security-layers.md) | Rate limiting, CORS, CSP, RBAC, IDOR protection |
| [deployment.md](./deployment.md) | Docker Swarm architecture, containers, secrets |
| [concurrency.md](./concurrency.md) | Optimistic locking, idempotency, CAS patterns |
| [localization.md](./localization.md) | i18n: framework, locale files, RTL, parity testing |
| [api-reference.md](./api-reference.md) | API route catalog: endpoints, methods, auth, request/response |
| [testing-strategy.md](./testing-strategy.md) | Test pyramid, phase gates, staging, CI/CD |
| [operations-runbook.md](./operations-runbook.md) | Day-2 ops: monitoring, alerts, scaling, backup, DR |
| [database-migrations.md](./database-migrations.md) | Migration strategy, naming, rollback, FK constraints |
| [change-guide.md](./change-guide.md) | How to add features, routes, screens, admin pages |
| [architecture-decisions/](./architecture-decisions/) | ADR index — 10 architecture decision records |

---

## Diagrams

| Document | Description |
|---|---|
| [diagrams/container-diagram.md](./diagrams/container-diagram.md) | C4 Container diagram (Mermaid) |
| [diagrams/component-diagram.md](./diagrams/component-diagram.md) | Component diagrams: API, Mobile, Admin (Mermaid) |
| [diagrams/data-flow.md](./diagrams/data-flow.md) | Sequence diagrams: booking, payment, matching, moderation |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend (Web)** | Next.js 14 (App Router), React 18, Tailwind CSS |
| **Frontend (Mobile)** | Expo / React Native, React Navigation |
| **API** | Next.js Route Handlers (App Router) |
| **Database** | PostgreSQL 16 (prod) / SQLite (dev), Prisma ORM |
| **Auth** | Custom JWT (marketplace + staff), OTP (phone-based), bcryptjs |
| **Caching** | Redis (planned) |
| **Containerization** | Docker, Docker Swarm |
| **Reverse Proxy** | Traefik |
| **CDN / Edge** | Cloudflare |
| **Push Notifications** | Expo Push Notifications |

---

## System Principles

1. **Domain-Driven State Machines** — Job lifecycle, escrow, and workspace progress are governed by explicit state machines with validated transitions (`lib/domain/job-lifecycle.ts:44-59`).

2. **Double-Entry Financial Ledger** — All monetary movements are recorded as balanced debit/credit entries with idempotency guarantees (`lib/ledger.ts:11-16`).

3. **Multi-Tenant Matching** — Provider matching is country-aware with configurable weights, wave-based distribution, and fairness scoring (`lib/matching/config.ts:15-27`).

4. **Defense in Depth** — Security layers stack: middleware rate limiting, JWT verification, RBAC permission checks, and IDOR protection on every route.

5. **Offline-Safe Concurrency** — Optimistic locking (`updateMany` with status guard) prevents lost updates without distributed locks (`lib/domain/job-lifecycle.ts:85-89`).

---

## Key Conventions

- All monetary values are stored as `bigint` (minor units / cents).
- Currency codes follow ISO 4217 (e.g., `LKR`, `CAD`).
- Basis points (bps) are used for rate calculations (100 bps = 1%).
- State transitions use `updateMany` with a WHERE clause matching the current state for optimistic concurrency.
- Idempotency keys are required for all ledger postings.
- Phone numbers are stored in full E.164 format (e.g., `+94771234567`).
- All admin actions are audit-logged with actor identity and timestamp.
