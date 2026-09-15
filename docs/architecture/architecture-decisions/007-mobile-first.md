# ADR-007: Next.js + Expo Dual-Platform Approach

**Status**: Accepted
**Date**: 2026-09-14

## Context

The marketplace serves two primary audiences: customers browsing and booking services (primarily mobile), and providers managing jobs, quotes, and payments (mobile in the field). The admin panel is desktop-only. The platform needs native mobile apps for iOS and Android while maintaining a web presence for SEO, customer acquisition, and the admin panel.

A single cross-platform framework cannot serve both web and native well. React Native excels at native mobile but has poor web support. Next.js excels at web but cannot produce native apps.

Reference: `apps/mobile/` (Expo React Native), `app/` (Next.js 14)

## Decision

Adopt a dual-platform approach:

### Web Platform (Next.js 14)
- **Purpose**: Customer-facing website, SEO, admin panel
- **Stack**: Next.js 14 App Router, Tailwind CSS, shadcn/ui
- **Deployment**: Docker Swarm on VPS, behind Cloudflare + Traefik
- **Auth**: JWT access + refresh tokens, cookie-based sessions for admin

### Mobile Platform (Expo React Native)
- **Purpose**: Provider and customer mobile apps (iOS + Android)
- **Stack**: Expo managed workflow, React Native, Expo Router
- **Auth**: JWT (18-day session), Bearer token in Authorization header
- **Features**: Push notifications (Expo Push), maps (native), OTP-based login

### API Sharing

Both platforms consume the same API routes under `app/api/mobile/v2/`. The Next.js server handles both web rendering and API serving. Mobile clients hit the same endpoints as web, differentiated by the `/api/mobile/` prefix.

### Authentication Separation

- Web admin: HMAC cookie + JWT admin sessions
- Mobile: JWT with phone-based OTP authentication
- Both share `NEXTAUTH_SECRET` for token signing but use separate session management

## Consequences

### Positive
- Native mobile performance: push notifications, maps, camera, biometrics
- SEO-friendly web presence: server-rendered pages, sitemap, structured data
- Shared API layer: one backend serves both platforms
- Separate deployment: mobile app updates via App Store, web via Docker

### Negative
- Two codebases to maintain: React Native and Next.js
- Feature parity requires explicit effort: mobile and web may diverge
- Testing matrix doubles: iOS, Android, Web browsers

### Neutral
- Expo managed workflow limits native module usage but simplifies builds
- API versioning (v1 legacy, v2 current) managed in Next.js route handlers
