# MaintainEX CRM V2 — App Function Control Matrix

## Purpose

This matrix defines what CRM V2 may safely control, configure, observe, or leave to source-code deployment.

The key rule:

> CRM is an operational control plane, not a live code editor.

Every function must belong to one of four classes:

- **FULL CONTROL** — CRM can safely read and change canonical business state through domain services.
- **CONFIG CONTROL** — CRM changes server-side configuration that the mobile/web runtime actually consumes.
- **OBSERVE / LIMITED ACTION** — CRM can inspect state and perform narrow safe actions, but must not arbitrarily mutate the subsystem.
- **DEPLOYMENT REQUIRED** — source-code, schema, security or algorithm changes require code + tests + CI + deployment.

Some domains intentionally use more than one class.

---

## Detailed function map

| App / platform function | Control class | What CRM V2 should do | What CRM V2 must NOT do | Example |
|---|---|---|---|---|
| Customer account active/suspended state | FULL CONTROL | Suspend/reactivate account, revoke sessions, add audited support action | Edit auth claims directly or bypass account rules | Fraudulent customer -> suspend + revoke sessions |
| Customer profile correction | FULL CONTROL, scoped | Correct approved fields with audit and validation | Rewrite identity/KYC data without evidence or authorization | Fix misspelled customer name after verification |
| Customer addresses | FULL CONTROL, restricted | View/mask, correct/remove with permission | Reveal all addresses to unrelated staff | Support corrects a wrong saved address |
| Customer sessions/devices | OBSERVE / LIMITED ACTION | View active sessions/device summaries, revoke sessions | Invent device state or expose raw tokens | Revoke suspicious session |
| Customer notification preferences | FULL/CONFIG depending runtime | Update canonical user preferences if app consumes them | Toggle nonexistent preference flags | Disable marketing push for customer |
| Customer membership | FULL CONTROL if canonical membership engine exists | Activate/cancel/refund/inspect according to membership lifecycle | Change price/entitlement without canonical rules | Cancel paid membership with proper refund path |
| Customer vouchers | FULL CONTROL for issuance/revocation; CONFIG for campaign rules | Issue/revoke, inspect redemption, manage eligibility rules | Mark redeemed manually without redemption service | Revoke abused voucher |
| Customer wallet | OBSERVE / LIMITED ACTION; FULL only through ledger service | View ledger/balance, freeze, controlled adjustment via audited ledger entry | Set balance directly | Correct ledger through compensating transaction |
| Customer booking/job creation | FULL CONTROL through job domain | Create/cancel on behalf of customer when policy permits | Directly set arbitrary lifecycle states | Support creates replacement booking |
| Customer job cancellation | FULL CONTROL through lifecycle service | Cancel when current state allows; coordinate payment/escrow | Set status=CANCELLED directly | Cancel before work start |
| Customer reviews | FULL CONTROL for moderation, not authorship | Approve/hide/remove/flag, investigate abuse | Create fake positive reviews for users | Remove abusive review |
| Customer disputes | FULL CONTROL through dispute domain | Open/assign/escalate/resolve according to rules | Resolve by directly editing finance state | Support opens dispute from customer complaint |
| Tasker account status | FULL CONTROL | Suspend/reactivate, revoke sessions, remove from matching | Override fraud/KYC rules silently | Suspend unsafe provider |
| Tasker profile | FULL CONTROL, scoped | Correct public/business fields with audit | Alter identity evidence without KYC flow | Update business phone |
| Tasker profession/skills | FULL CONTROL through eligibility rules | Add/remove approved professions/skills, review submissions | Assign unsupported skill to bypass verification | Approve electrician profession |
| Tasker job-selection preferences | FULL CONTROL or CONFIG | Change canonical selected services/preferences if runtime uses them | Modify hidden static mobile-only arrays | Support removes accidental category |
| Tasker availability | FULL CONTROL, scoped | Pause/activate availability with audit | Forge live location or active-job state | Pause provider after support request |
| Tasker service area | FULL CONTROL / CONFIG | Set eligible service geography from canonical location data | Let staff bypass country restrictions | Update service radius/areas |
| Tasker live location | OBSERVE ONLY except privacy-safe reset/disable | Show latest authorized location for active job | Edit/forge tasker GPS coordinates | Ops sees provider approaching customer |
| Tasker readiness | FULL CONTROL only for explicit verified checks; otherwise OBSERVE | Review blockers, approve records where policy allows | Force readiness=true when requirements unmet | KYC approval clears readiness blocker |
| Tasker KYC | FULL CONTROL via KYC workflow | Approve/reject/request re-upload/revoke | Edit document contents or expose raw files publicly | Reject expired ID |
| Tasker certifications | FULL CONTROL | Approve/reject/expire/revoke credentials | Fabricate certification | Expire lapsed trade license |
| Tasker ratings/reputation | OBSERVE + moderation actions | View metrics, flag manipulation, recalc through canonical service | Manually set star average | Trigger reputation rebuild after invalid review removed |
| Tasker earnings | OBSERVE | Show canonical earnings/ledger | Manually set earnings totals | Review weekly earnings |
| Tasker wallet | OBSERVE / LIMITED ACTION | View ledger, freeze, payout actions via finance services | Set wallet balance directly | Freeze wallet during fraud review |
| Tasker withdrawal | FULL CONTROL through payout workflow | Review/process/reject withdrawal | Mark paid manually | Approve verified withdrawal |
| Tasker company assignments | FULL CONTROL through assignment service | Assign/unassign based on company/workforce rules | Attach tasker to arbitrary company without authorization | Remove former worker from company assignment |
| Company account status | FULL CONTROL | Suspend/reactivate company, block new work | Directly change unrelated employees/finance | Suspend company for KYC failure |
| Company profile | FULL CONTROL, scoped | Correct company details | Alter registration/KYC evidence outside workflow | Update contact info |
| Company KYC/certifications | FULL CONTROL via trust workflow | Review/approve/reject/revoke | Force verified flag directly | Approve company registration doc |
| Company team members | FULL CONTROL | Invite/remove/role-change through workforce domain | Grant app privileges outside company-role model | Remove resigned employee |
| Company invitations | FULL CONTROL / OBSERVE | View/revoke/resend valid invites | Reveal invite tokens | Revoke leaked invite |
| Company workforce assignment | FULL CONTROL | Assign eligible employee to job, reassign when lifecycle permits | Ignore busy/eligibility/job-state rules | Reassign employee after absence |
| Company dispatch | FULL CONTROL | Manage dispatch/assignment state through canonical workflow | Directly fake arrival/completion | Dispatch technician to booked job |
| Company contracts | FULL CONTROL where canonical contract workflow exists | View/manage status and approved fields | Invent contractual states not used by app | Close completed service contract |
| Company milestones | FULL CONTROL where runtime uses them | Create/update/complete according to milestone lifecycle | Use as fake finance ledger | Mark verified milestone complete |
| Company subscriptions | FULL CONTROL + CONFIG | Manage plan, renewal/cancel; configure plan catalog separately | Grant hidden entitlements not represented in plan service | Upgrade company plan |
| Company earnings | OBSERVE | View earnings and settlement history | Directly set total earnings | Finance inspects earnings |
| Company payouts | FULL CONTROL through payout service | Review/process/reject | Modify destination without verified process | Process weekly company payout |
| Jobs list/search | OBSERVE + safe actions | Search/filter/view scoped jobs; trigger allowed actions | Return all countries/PII to every staff member | Ops finds delayed jobs |
| Job status | FULL CONTROL only through lifecycle service | Execute allowed transitions | Arbitrary status edit | Admin cancels before start |
| Job schedule | FULL CONTROL, lifecycle-aware | Reschedule if customer/provider rules allow | Change schedule after completion | Move appointment to tomorrow |
| Job location/address | FULL CONTROL, restricted | Correct location with customer authorization and audit | Reveal exact address outside job need | Correct wrong map pin before dispatch |
| Job provider assignment | FULL CONTROL | Assign/reassign eligible provider/company | Assign ineligible/suspended/busy provider | Reassign no-show provider |
| Job PIN/verification state | OBSERVE + narrow control | View PIN state; revoke/rotate only via verification service | Reveal raw PIN unnecessarily or mark verified manually | Rotate compromised start PIN |
| Arrival verification | OBSERVE / LIMITED ACTION | Inspect evidence/state; controlled exception flow if policy defines one | Set arrived=true directly | Trust team reviews failed geofence |
| Work-start verification | OBSERVE / LIMITED ACTION | Inspect state; approved exception only through domain service | Bypass payment/verification rules | Support resolves documented PIN failure |
| Completion verification | FULL CONTROL only through completion workflow | Confirm/approve/cancel completion request per rules | Force complete by DB update | Resolve customer-confirmation edge case |
| Job inspections | FULL CONTROL | Review/create/update inspection workflow if domain permits | Fabricate inspection evidence | Require inspection before expensive repair |
| Job evidence | FULL CONTROL for moderation/attachment management | View authorized evidence, remove malicious/invalid file | Edit evidence content | Remove unsafe upload |
| Change orders | FULL CONTROL through change-order service | Approve/reject/revise according to parties/lifecycle | Change price directly outside signed change order | Approve added material cost |
| Quotes | FULL CONTROL through quote domain | Review, invalidate fraudulent quote, support revision/selection where policy permits | Edit quote amount after acceptance without revision | Void duplicate fraudulent quote |
| Quote pricing | OBSERVE / LIMITED ACTION | Show amount/components; support canonical revision | Arbitrary admin price rewrite | Ask provider to submit revised quote |
| Matching | CONFIG + OBSERVE | Configure safe matching parameters if runtime consumes them; inspect matching result | Manually manipulate hidden ranking without audit | Adjust max provider radius |
| AI/search matching | CONFIG + OBSERVE | Tune approved thresholds/config; monitor quality | Hot-edit model/code from CRM | Disable experimental matching mode |
| Chat conversations | OBSERVE + FULL moderation/support actions | View authorized conversations, support reply where policy allows, moderate attachments | Edit historical user messages silently | Support joins dispute conversation |
| Internal notes | FULL CONTROL, staff-only | Create/edit within audit policy | Expose to customers/taskers | Add risk investigation note |
| User notifications | FULL CONTROL | Send transactional/manual support notification with permission | Send arbitrary mass push without review | Notify customer of rescheduled job |
| Broadcast notifications | FULL CONTROL with high-risk guard | Audience preview, confirmation, idempotent broadcast | One-click unrestricted mass push | Send service interruption notice |
| Notification templates | CONFIG CONTROL | Edit approved server-side templates if runtime uses them | Embed secrets/unsafe HTML | Update maintenance notice copy |
| Payment intent | OBSERVE + domain actions | Inspect state, trigger safe retry/reconciliation | Create fake paid state | Retry failed payment intent |
| Payment amount/currency | DEPLOYMENT/DOMAIN RULE, not staff edit | Display server-calculated values; correct via quote/change-order/business flow | Direct admin override of amount/currency | Amount changes only via accepted change order |
| Payment status | OBSERVE / LIMITED ACTION | Reconcile gateway result | Set PAID manually | Re-sync gateway transaction |
| Cash payment | FULL CONTROL through cash workflow | Record/verify cash state according to policy | Mark cash collected without authorized evidence/process | Confirm provider-recorded cash receipt |
| Escrow | FULL CONTROL through escrow state machine | Hold/release/refund when rules permit | Direct status edit | Release after verified completion |
| Refund | FULL CONTROL through refund service | Approve/process/reject within remaining refundable amount | Refund above charge or twice | Process partial refund |
| Wallet balances | OBSERVE / controlled ledger action | Display ledger, freeze, compensating adjustment | Set numeric balance | Add audited correction ledger entry |
| Payout destination | FULL CONTROL only through verified destination-change workflow | Review/verify updates | Simple text edit of bank details | Re-verify changed payout account |
| Payouts | FULL CONTROL through payout engine | Process/reject/retry/reconcile | Mark payout complete without provider response | Retry failed payout |
| Commission rules | CONFIG CONTROL | Change future commission config/version with owner permission | Rewrite historical commission ledger | Set future platform fee to approved rate |
| Commission owed/paid history | OBSERVE | View canonical ledger | Rewrite past amounts | Inspect outstanding commission |
| Settlements | FULL CONTROL through settlement service | Generate/process/confirm/reconcile | Arbitrary settlement status edit | Confirm bank settlement after verification |
| Financial ledger | OBSERVE; append-only corrective actions only | Search/export scoped ledger, compensating entries | Edit/delete historical entries | Add reversal entry |
| Payment gateway credentials | DEPLOYMENT/SECURE OPS | Show configured/not-configured status only | Display/edit secret in CRM browser by default | Rotate secret through secure deployment/secret manager |
| Payment webhooks | OBSERVE | Show webhook health/recent safe metadata | Edit signature verification behavior | See failed callback count |
| Pricing estimates | CONFIG + OBSERVE | Manage approved pricing config/ranges/benchmarks | Hot-edit algorithm code | Update market labor range |
| Pricing algorithm | DEPLOYMENT REQUIRED | Show version/health | Change formula/code live | Fix incorrect estimator math |
| Market/country availability | CONFIG CONTROL | Enable/disable supported markets/channels safely | Invent market unsupported by backend/data rules | Disable bookings in CA |
| Currency per market | CONFIG CONTROL with migration constraints | Manage supported currency config for future jobs | Change currency on existing financial records | New LK jobs use LKR |
| Locations/areas | FULL/CONFIG | Add/disable supported service areas | Modify historical job country/location semantics | Add new supported city |
| Catalog categories | FULL CONTROL | Create/edit/order/activate canonical categories | Maintain separate website/mobile copies | Add Appliance Repair |
| Catalog subcategories | FULL CONTROL | Create/edit/activate | Static-only frontend category | Add Washing Machine Repair |
| Service templates | FULL CONTROL | Manage template, questions, eligibility, pricing mode, visibility | Publish incomplete unsafe template | Launch AC servicing template |
| Booking questions/attributes | FULL CONTROL | Create/order/validate schema consumed by runtime | Inject unsafe executable content | Add “number of AC units” question |
| App catalog visibility | CONFIG CONTROL | Toggle app channel visibility | Modify app static bundle directly | Hide seasonal category |
| Website catalog visibility | CONFIG CONTROL | Toggle website channel visibility | Separate duplicate website record | Website-only launch delay |
| Profession catalog | FULL CONTROL | Manage professions/skills/submissions | Bypass credential requirements | Add Solar Technician profession |
| Offers/seasonal offers | FULL CONTROL + CONFIG | Create/schedule/activate/deactivate, set eligibility | Forge redemption/payment state | Schedule New Year promotion |
| Flash offers | FULL CONTROL + CONFIG | Manage campaign/limits/time window | Allow unlimited claim if rule says one-per-user | Launch 2-hour promo |
| Offer claims/redemptions | OBSERVE / limited correction | Inspect/revoke fraudulent claim through domain rules | Mark arbitrary redemption manually | Cancel duplicate fraudulent claim |
| Subscription plan catalog | CONFIG CONTROL | Manage future plans/benefits/pricing if runtime consumes config | Edit existing paid contract history silently | Introduce Business Pro plan |
| Subscription state | FULL CONTROL through subscription lifecycle | Cancel/renew/upgrade/downgrade per policy | Grant hidden benefit not in plan | Cancel expired company subscription |
| Vouchers | FULL CONTROL + CONFIG | Campaign rules + individual issue/revoke | Rewrite redemption history | Issue support compensation voucher |
| Real-estate listing approval | FULL CONTROL | Approve/reject/suspend/feature listing | Change owner to unrelated user | Approve verified listing |
| Real-estate listing content | FULL CONTROL, moderated | Edit/correct approved fields with audit | Fabricate seller data | Remove prohibited text |
| Real-estate images | FULL CONTROL with upload security | Moderate/remove/reorder | Serve unsafe executable files | Remove misleading photo |
| Real-estate listing price | FULL CONTROL with owner/audit policy | Correct with seller authorization | Manipulate price secretly | Fix seller-entered typo |
| Real-estate boosts | FULL CONTROL through boost/payment rules | Activate after payment/eligibility | Free boost by DB flag unless authorized promo | Feature paid listing |
| Real-estate inquiries | OBSERVE / moderation | Inspect support/fraud issues | Read broadly without need | Investigate spam inquiry |
| Favorites metrics | OBSERVE | Aggregate analytics | Edit favorites counts | Analyze demand |
| Search/global search | OBSERVE | Search scoped canonical data | Search secrets/all-market data regardless permission | Find job/customer by safe identifiers |
| Search ranking logic | DEPLOYMENT or CONFIG if externalized safely | Tune only approved server config | Hot-edit code/model | Change minimum query length |
| File uploads | CONFIG + OBSERVE | Manage limits/types/storage policy config; inspect metadata | Disable validation or expose private bucket | Set max dispute upload size |
| Individual private files | FULL CONTROL, scoped | Authorize/view/remove/quarantine | Publicize KYC file | Quarantine malicious evidence |
| Authentication/login policy | CONFIG, restricted | Manage approved security policies such as session TTL only if implemented safely | Edit JWT secrets or password hashing from browser | Reduce admin session TTL |
| User password | LIMITED ACTION | Trigger secure reset/revoke sessions | View/set plaintext password | Send reset flow |
| Admin password | LIMITED ACTION | Owner-triggered secure reset flow | Display password/hash | Reset compromised staff account securely |
| Staff role | FULL CONTROL with owner guard | Assign role template | Self-promote or bypass delegation rules | Promote support lead to manager |
| Staff granular permissions | FULL CONTROL with strict delegation | ALLOW/DENY delegable capabilities | Grant owner-only permission | Allow finance refunds but deny staff management |
| Staff country scope | FULL CONTROL | Assign supported market scope | Bypass scope with client token | Give CA team CA-only access |
| Staff 2FA | OBSERVE + LIMITED ACTION | Show status; enforce/revoke/re-enroll securely | Display TOTP secret after enrollment | Require re-enrollment after lost phone |
| Admin sessions | FULL CONTROL | View safe metadata/revoke | Show refresh token/hash | Revoke stolen session |
| Security blocked IPs | FULL CONTROL, security role | Add/remove temporary/permanent block with audit | Treat IP blocking as only auth defense | Block abuse source |
| Failed-login events | OBSERVE | Inspect/risk triage | Delete evidence casually | Investigate brute force |
| Security events | OBSERVE + response actions | Investigate/resolve/escalate/block/revoke | Rewrite event history | Revoke account after impossible travel |
| Audit log | OBSERVE ONLY | Search/export within policy | Edit/delete through normal CRM | Review who released escrow |
| Application health | OBSERVE ONLY | Show healthy/degraded, safe diagnostics | Restart/reconfigure server blindly from CRM | Show API/DB readiness |
| Database health | OBSERVE ONLY | Connectivity/readiness metrics | Run arbitrary SQL from CRM | Show DB healthy |
| Database schema | DEPLOYMENT REQUIRED | Display migration/version metadata | Alter schema from CRM | Add new column through migration |
| Background cron jobs | OBSERVE / LIMITED ACTION | Show last run/result; safe retry if operation is idempotent and explicitly supported | Edit cron code/schedule arbitrarily from browser | Retry failed notification cron |
| Escrow auto-release policy | CONFIG CONTROL | Change future safe config with owner permission | Rewrite code or release historical jobs blindly | Change future auto-release days |
| Matching-wave scheduler | CONFIG/OBSERVE | Enable/disable safe runtime config; show health | Change algorithm code | Pause matching during incident |
| Email/SMS/push provider state | OBSERVE | Show configured/healthy, delivery failure stats | Reveal provider secrets | Detect SMS outage |
| Third-party API credentials | DEPLOYMENT/SECRET MANAGER | Show status only | Expose/edit raw secret in normal CRM | Rotate Map API secret via secure ops |
| App maintenance mode | CONFIG CONTROL if runtime consumes it | Enable/disable with owner permission and confirmation | Toggle a flag app ignores | Temporarily stop new bookings |
| Website maintenance mode | CONFIG CONTROL if runtime consumes it | Enable/disable | Pretend site is offline if route ignores setting | Maintenance banner/booking stop |
| Feature flags | CONFIG CONTROL only for wired flags | Manage allowlisted server-consumed flags | Generic arbitrary key/value execution | Enable new quote UI for 10% users if supported |
| Mobile minimum version | CONFIG if update gate exists | Set supported/min version | Pretend to force update without client support | Require newer app build |
| Mobile React/UI bug | DEPLOYMENT REQUIRED | Surface incident only | Patch JS/TS source from CRM | Fix broken booking button in code |
| Website React/UI bug | DEPLOYMENT REQUIRED | Surface incident only | Edit source bundle live | Fix layout/navigation defect |
| API logic bug | DEPLOYMENT REQUIRED | Observe errors | Change implementation through DB flags unless explicitly designed | Fix broken quote endpoint |
| Authentication vulnerability | DEPLOYMENT REQUIRED, emergency controls may mitigate | Temporarily disable affected feature/session class | “Fix” vulnerability with hidden UI | Patch vulnerable route and deploy |
| Financial algorithm bug | DEPLOYMENT REQUIRED + operational freeze | Freeze affected action/config while patching | Manually compensate without ledger | Disable payout processing, patch, then resume |
| Database/model bug | DEPLOYMENT REQUIRED | Observe/migrate safely via release pipeline | Edit schema interactively in CRM | Add missing unique constraint |
| New app feature | DEPLOYMENT REQUIRED plus later CRM configuration | CRM may manage feature after runtime support exists | Create frontend functionality from CRM alone | Build new bidding mode in code first |
| Logs | OBSERVE, restricted | Search redacted operational logs | Show secrets/raw auth headers | Investigate request error |
| Infrastructure topology | OBSERVE MINIMALLY | Show safe service health labels | Expose IPs/ports/credentials unnecessarily | “Payment service healthy” rather than internal address |
| Docker/Traefik config | DEPLOYMENT/OPS | Surface status | Generic root-level infrastructure editor in CRM | Change routing through controlled ops/deploy process |
| Backups | OBSERVE + controlled ops | Show last backup verification; authorized restore workflow can be separate | One-click destructive restore from ordinary CRM | Confirm nightly backup is valid |

---

## CRM control policy by class

### FULL CONTROL

Use when:
- canonical state already exists,
- business invariants are well-defined,
- authorization can be enforced,
- the action is auditable/recoverable.

Pattern:

```
CRM action
 -> permission
 -> object/country scope
 -> validation
 -> canonical domain service
 -> transaction/idempotency
 -> audit
 -> notification
```

Examples:
- suspend a tasker
- approve KYC
- reassign a company employee
- resolve a dispute
- activate a service template
- process a permitted refund
- revoke a staff session

### CONFIG CONTROL

Use when:
- a runtime reads server-side configuration,
- configuration can be validated/allowlisted,
- changing it does not bypass core invariants.

Examples:
- turn service visibility on/off
- enable website booking in a market
- set future commission rate
- schedule a promotion
- configure supported service area
- enable maintenance mode

A control is prohibited if the app/web runtime does not actually read it.

### OBSERVE / LIMITED ACTION

Use when arbitrary mutation would be unsafe.

Examples:
- payment gateway state
- audit logs
- database health
- live GPS
- financial ledger
- security events
- cron health

Possible narrow actions:
- retry idempotent operation
- revoke session
- quarantine file
- block account
- trigger reconciliation

### DEPLOYMENT REQUIRED

Use when changing the behavior requires source/schema/security changes.

Examples:
- React UI bug
- broken API handler
- payment algorithm defect
- auth vulnerability
- DB schema change
- new workflow not implemented by runtime
- new matching algorithm
- new mobile capability

Required path:

```
issue
 -> safe operational mitigation if needed
 -> code fix
 -> tests
 -> CI/security review
 -> migration if needed
 -> deployment
 -> smoke test
 -> CRM observes healthy state
```

---

## High-level app surface coverage

CRM V2 is expected to provide operational coverage for:

- Customer: account, profile, addresses, jobs, payments, wallet, disputes, reviews, membership/vouchers, notifications.
- Tasker: profile, professions/skills, service area, availability, KYC, jobs/quotes, evidence/inspections, wallet/withdrawal, company assignment, risk.
- Company: profile, KYC, team/invites, workforce, dispatch, contracts, milestones, jobs, finance, subscription, risk.
- Marketplace: catalog, search visibility, matching config, jobs, quotes, change orders, schedule, verification, messaging.
- Finance: payment, cash, escrow, refunds, wallet, payouts, commission, settlements, reconciliation.
- Platform: markets, locations, pricing config, offers, subscriptions, channel visibility, notifications, app/web operational state.
- Real estate: listings, moderation, boosts, inquiries, analytics.
- Staff/security: roles, granular permissions, markets, sessions, 2FA status, audit, security events.
- Reliability: health, cron execution, integration health, backup status.

The CRM does not replace the software delivery pipeline for defects or new application logic.
