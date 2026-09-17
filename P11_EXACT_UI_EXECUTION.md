# Phase 11 V3.3 Exact UI Takeover

Branch: `phase11-v3-exact-ui`
Baseline: `e9238a3eb0802c04bbfd037e28cde82e4dd9354c`

## Goal
Ship the approved MaintainEX V3.3 mobile UI without changing Phase 1–10 business logic. The route-complete design package contains 285 approved screen/state SVGs. Those designs are the visual source of truth.

## Rules
- Preserve APIs, auth/session semantics, route params, deep links, job lifecycle, matching, quotes, escrow/payment, wallet, chat, tasker/company logic and RBAC.
- Replace old visual presentation; do not merely recolor old layouts.
- Use the exact V3.3 hierarchy/geometry at the 390x844 baseline, with responsive safe-area/content adaptations only.
- Use Outfit + Phosphor + `theme/v3` tokens for migrated presentation.
- Do not merge to `main` or deploy production until final QA.

## Execution order
1. V1 Auth + Customer core discovery
2. V2 Post job + matching + quotes
3. V3 Payment + active-job lifecycle
4. V4 Customer account/wallet/settings/chat
5. V5 Property/rentals
6. V6 Tasker setup/profile/shell
7. V7 Tasker work/earnings
8. V8 Company shell/operations/finance/profile
9. V9 Runtime/validation/recovery/success/restriction states
10. Final 285/285 coverage + regression + simulator/device visual QA

## Completion model
The 285 designs are not 285 router routes. Main routes are implemented as React Native screens; design variants are wired as state-driven components/sheets/empty/loading/error/recovery states.

A route/state is complete only when:
- Visual target matches its approved V3.3 SVG/PNG.
- Existing functional behavior is preserved.
- Relevant loading/empty/error/offline/permission/validation states are connected.
- No legacy dark visual implementation remains in the active path.

## Merge gate
- Approved design coverage: 285/285
- PARTIAL: 0
- LEGACY: 0
- MISSING: 0
- WRONG_DARK: 0
- Active Ionicons: 0
- Active `lib/design`: 0
- TypeScript: PASS
- Expo export: PASS
- iOS/Android navigation regression: PASS
- 390x844 representative visual comparison: PASS

No production merge before all gates pass.
