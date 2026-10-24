# International launch audit — 24 October 2026

Status: **PARTIAL; NOT LAUNCH CERTIFIED. PR #80 must remain draft.**
This receipt does not replace the canonical master plan or grant production,
crew, catalogue, payment-provider or deployment approval. Tracking: #89.

## Preservation and integration

Continued `feature/international-launch-12phase`. Preserved the two existing
stashes and the two previously unpushed commits. Saved the initial working diff
before edits. Committed the existing catalogue conflict-resolution repairs as
`2f68fb87`. Integrated the histories behind PRs #134, #136 and #141 with merge
commit `2e46d150`, without rewriting commits or merging into main. The initial
uncommitted `PHASE-STATUS.md` changes remain outside this audit's commits.

No production database, deployment, live transaction or provider activation was
used. PostgreSQL tests ran on a disposable loopback instance. The machine's
existing mobile installation was SDK 57 while its committed lockfile is SDK 56;
SDK 56 installation/export/typechecking used a disposable source copy, preserving
the existing local mobile installation.

## Findings and repairs

- **Exact-service authorization:** PostgreSQL reproduced quote acceptance by an
  individual provider selected for a sibling service. Acceptance omitted the
  TemplateJob identity passed to eligibility. This also denied legitimate
  job-specific company quotes. Reused the canonical service requirement resolver;
  six PostgreSQL cases cover direct/linked service denial and valid acceptance.
- **Stored XSS:** public service JSON-LD interpolated database strings with raw
  JSON.stringify into HTML script content. Added escaped serialization in the
  existing SEO owner and updated every matching public script sink. Rendering
  tests preserve JSON meaning and prevent script termination/injection.
- **Legacy public market/privacy boundary:** service detail and city detail
  queries lacked country scoping; review serialization included reviewer account
  IDs. Scoped service, metadata and related-service reads by market and selected
  only public review fields. PostgreSQL page tests exercise LK and CA records
  sharing a slug and assert account IDs never reach client props.
- **Image optimizer outbound scope:** replaced arbitrary HTTPS hosts with the
  four hosts used by existing consumers. Tests exercise Next's real matcher
  against metadata/local addresses, attacker hosts, lookalike hosts and ports.
- **Dependencies:** Next.js and eslint-config-next are 15.5.28; patched DOMPurify,
  follow-redirects, Zod and affected tooling overrides. Web production and complete
  web dependency audits have zero critical/high findings. Moderate/low findings
  remain; this is not a zero-vulnerability claim.
- **Test safety:** replaced a production-name denylist with explicit local test
  database validation before suite imports; reject remote hosts, misleading URI
  substrings, schema/host overrides and conflicting database URLs.
- **Release gates:** the full regression suite is blocking, with a local built
  HTTP server and both integration URL flags. Serialized files avoid shared
  configuration races. Lint is explicit. Repaired catalogue/pricing fixtures,
  currency-aware wallet conflict keys, real assignment/PIN setup and capacity
  teardown in formerly skipped suites. Assertions continue to enforce denial,
  financial balance, idempotency and lifecycle boundaries.

Sources for dependency decisions:
[Next.js security release](https://nextjs.org/blog/nextjs-security-update-october-14-2026),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

## Confirmed-unused removal

Removed the unused `shadcn` authoring CLI dependency after searching source,
configuration and scripts for consumers. Existing generated UI and its config
remain. This removed its unused transitive tooling graph. Removed the obsolete
unsafe database-test denylist/parser and unused marker after replacing their
callers. No database models, historical records or legacy API consumers were
blindly deleted.

## Executed evidence and limits

- Initial Phase 04 PostgreSQL exercise: **9/9 passed**. Expanded stacked crew
  database tests also executed; crew endpoints remain disabled as designed.
- Initial full run: 4,146 passed / 2 failed / 60 skipped; fixture repair and
  integration flags address this baseline rather than hiding its results.
- All-enabled run: 4,587 passed / 7 failed / 0 skipped. Following corrections,
  serialized run: 4,591 passed / 3 failed / 0 skipped. The remaining pricing
  cases depended on a prior suite's market configuration; explicit rate setup
  and restoration now give the fixture its own deterministic contract.
- Forty local built-server HTTP security tests passed, using synthetic accounts.
- Focused exact-service, isolation, image-origin and CI-gate tests: 39 passed.
- Public market/privacy and structured-data regressions: 6 passed.
- Web/mobile TypeScript and production build executed. Lint has 0 errors and
  41 existing warnings. Android and iOS SDK 56 bundle exports and isolated
  SDK 56 TypeScript passed with the patched mobile Zod override.
- Repository tree/history exposure scanner executed without printing secret
  values: no current blocking credential findings. History candidates still
  require credential-revocation evidence; history was not rewritten.
- Docker is unavailable locally. Docker build/start, runtime UID and container
  market smoke remain GitHub CI gates. Exact final-SHA CI is authoritative and
  must be checked separately; historical successful runs cannot certify it.

Test and build logs used for this local audit are outside the repository under
`/tmp/maintainex-deep-audit`. They contain synthetic fixture details and are not
published. CI uploads the corresponding diagnostics using existing workflows.

## Original twelve phases — acceptance gaps

This matrix distinguishes implemented/tested code from the full master-plan exit
gates. File existence and passing structural tests are not phase acceptance.

| Phase | Evidence reviewed | Remaining gate |
|---|---|---|
| 00 Baseline | Local changes/stashes/PR histories, executable isolated baseline | Production aggregate inventory and image provenance not collected |
| 01 Catalogue | Canonical CRM/catalogue integrity, inactive proposal gates | 309 proposed entries, publication decision, aliases and market/provider coverage acceptance |
| 02 Geography | Market/boundary and cross-market regressions | Address-text/coordinate verification requires approved geocoding credentials/policy |
| 03 Discovery | Canonical eligibility/isolation, exact-service correction | Both-market operational provider coverage and complete human search acceptance |
| 04 Onboarding | Expanded crew PostgreSQL gates, identity, capacity and authorization | Production crew arrival/start activation remains prohibited; physical/operations acceptance pending |
| 05 Pricing | Safe scalar input, local currency, benchmark threshold and arithmetic | Verified Canadian market evidence and pricing policy acceptance |
| 06 Quotes | Revision arithmetic/history and exact-service acceptance regressions | Voice/recovery and complete both-market negotiation acceptance |
| 07 Safety/projects | Safety intake, identity/PIN and assignment tests; existing milestones | Trusted-contact consent/expiry sharing and full post-incident/real-device acceptance are incomplete |
| 08 Seasonal | Existing canonical market-aware offers and regressions | Actual weather/coverage/CRM campaign acceptance |
| 09 Languages | EN/SI/TA dictionaries and French beta/fallback tests | Independent native review of binding scope, safety, consent and payment meaning |
| 10 Finance/operations | Mock/disposable-ledger races and financial gates | PSP sandbox credentials/receipts, legal/privacy/licence/insurance/support ownership sign-off |
| 11 Certification | Blocking CI, schema, build and HTTP regressions | Exact final SHA checks plus signed LK/Vancouver GO, device and backup/rollback exercise receipts |

**Unresolved high advisory:** Expo CLI depends on node-forge 1.4.0; upstream has
no published patched release. The existing narrow, self-expiring exception still
reports it and was not broadened. Passing the controlled audit is not remediation
of that advisory. Consequently, the mission's no-unresolved-high completion gate
is not met and final merge/launch readiness cannot honestly be claimed.
