# MaintainEX Prisma Model Inventory

## Summary

- **Total models**: 122
- **Total monetary fields**: 72 across 38 models
- **Float money fields**: 30+ (CRITICAL)
- **BigInt money fields**: 12 (correct)
- **Schema provider**: SQLite (PostgreSQL via Docker sed swap)

## Complete Model Table

| # | Model | Purpose | Relations | Generation | Risk | Disposition |
|---|---|---|---|---|---|---|
| 1 | User | Core user account | sessions, otps, bookings, reviews, profiles, wallets | CURRENT | HIGH — shared JWT secret | KEEP |
| 2 | Admin | Legacy admin | branch | LEGACY | MEDIUM — dual admin models | MERGE |
| 3 | AdminUser | New admin with 2FA | sessions, refreshTokens | CURRENT | LOW | KEEP |
| 4 | Session | Mobile user sessions | user | CURRENT | LOW | KEEP |
| 5 | OTP | OTP codes | user | CURRENT | LOW | KEEP |
| 6 | LoginActivity | Login audit | user | CURRENT | LOW | KEEP |
| 7 | Category | Service categories | services | LEGACY | LOW — overlaps JobCategory | MERGE |
| 8 | Industry | Industry catalog | none | CURRENT | LOW | KEEP |
| 9 | Service | Catalog services | category, bookings, reviews | LEGACY | LOW | KEEP |
| 10 | Branch | Physical offices | bookings, admins, staff, applications | CURRENT | LOW | KEEP |
| 11 | Booking | Legacy bookings | user, service, branch, tasker | LEGACY | HIGH — parallel system | DEPRECATE |
| 12 | Review | Service reviews | user, service | LEGACY | LOW — overlaps TaskerReview | MERGE |
| 13 | Settings | Key-value config | none | LEGACY | MEDIUM — 3 settings tables | MERGE |
| 14 | AppSetting | Key-value config | none | CURRENT | MEDIUM — overlaps Settings | MERGE |
| 15 | JobMatchQueue | V1+V2 match queue | job, tasker | CURRENT | MEDIUM — shared by V1+V2 | REVIEW |
| 16 | OfferMatchQueue | Offer match queue | booking, tasker | CURRENT | LOW | KEEP |
| 17 | TaskerBadge | Provider badges | none (scalar userId) | CURRENT | LOW | KEEP |
| 18 | FraudEvent | Fraud tracking | none | CURRENT | LOW | KEEP |
| 19 | AdminFlag | User flags | user | CURRENT | LOW | KEEP |
| 20 | UserDevice | Device tracking | user | CURRENT | LOW | KEEP |
| 21 | OfferTemplate | Flash/offer templates | enrollments, bookings | CURRENT | LOW | KEEP |
| 22 | OfferEnrollment | Tasker enrollment | template, tasker | CURRENT | LOW | KEEP |
| 23 | OfferBooking | Offer bookings | template, customer, matchQueue | CURRENT | MEDIUM — unwired | REVIEW |
| 24 | PayoutRequest | Legacy payout requests | user | LEGACY | HIGH — overlaps Payout | MERGE |
| 25 | ActivityLog | Admin audit | none | CURRENT | LOW | KEEP |
| 26 | CustomerProfile | CRM profile | user, tags, addresses, etc. | CURRENT | LOW | KEEP |
| 27-36 | CRM Models | Customer tags, segments, addresses, notes, activities, communications | CustomerProfile | CURRENT | LOW | KEEP |
| 37 | SecurityAudit | Security audit | none | CURRENT | LOW | KEEP |
| 38 | ApiKey | API key management | none | CURRENT | LOW | KEEP |
| 39 | RateLimitLog | Rate limit tracking | none | CURRENT | LOW | KEEP |
| 40 | PasswordResetToken | Password reset | none (scalar userId) | CURRENT | LOW | KEEP |
| 41 | IpBlock | IP blocklist | none | CURRENT | LOW | KEEP |
| 42 | FailedLogin | Failed login tracking | none | CURRENT | LOW | KEEP |
| 43 | DataExport | Data export tracking | none | CURRENT | LOW | KEEP |
| 44 | JobVacancy | Job openings | branch | CURRENT | LOW | KEEP |
| 45 | Staff | Company staff | branch | CURRENT | LOW | KEEP |
| 46 | Invoice | Financial invoices | branch, items | CURRENT | MEDIUM — Float money | MIGRATE |
| 47 | InvoiceItem | Invoice line items | invoice | CURRENT | MEDIUM — Float money | MIGRATE |
| 48 | Quotation | Financial quotations | branch, items | CURRENT | MEDIUM — Float money | MIGRATE |
| 49 | QuotationItem | Quotation line items | quotation | CURRENT | MEDIUM — Float money | MIGRATE |
| 50 | JobCategory | V2 job categories | templateJobs, serviceTemplates | CURRENT | LOW — overlaps Category | KEEP |
| 51 | TemplateJob | Job templates | category, taskerSkills, bookings | CURRENT | LOW | KEEP |
| 52 | ServiceTemplate | Smart booking templates | jobCategory, templateJob | CURRENT | LOW | KEEP |
| 53 | CustomJobRequest | Custom job requests | user | CURRENT | LOW | KEEP |
| 54 | TaskerSkill | Provider skills | tasker, job | CURRENT | LOW | KEEP |
| 55 | TaskerProfile | Individual providers | user, bids, assignments, reviews, skills, matchQueue | CURRENT | LOW | KEEP |
| 56 | JobPosting | V1 job postings | customer, bids, assignments, disputes | DEPRECATED | MEDIUM | DEPRECATE |
| 57 | Bid | V1 bids | job, tasker | DEPRECATED | MEDIUM | DEPRECATE |
| 58 | Assignment | V1 assignments | job, tasker | DEPRECATED | MEDIUM | DEPRECATE |
| 59 | TaskerReview | V1 tasker reviews | tasker, reviewer | DEPRECATED | LOW | MERGE |
| 60 | Notification | Push notifications | user | CURRENT | LOW | KEEP |
| 61 | Dispute | Job disputes | job, raisedBy | CURRENT | LOW | KEEP |
| 62 | Conversation | Chat conversations | participants, messages | CURRENT | LOW | KEEP |
| 63 | ConversationParticipant | Chat participants | conversation, user | CURRENT | LOW | KEEP |
| 64 | Message | Chat messages | conversation, sender | CURRENT | LOW | KEEP |
| 65 | CompanyProfile | Company providers | user, contracts, teamMembers, specialties, invites, subscriptions | CURRENT | LOW | KEEP |
| 66 | TeamMember | Company workers | company, user | CURRENT | LOW | KEEP |
| 67 | TeamInvite | Company invitations | company | CURRENT | LOW | KEEP |
| 68 | CompanySpecialty | Company specialties | company | CURRENT | LOW | KEEP |
| 69 | SubscriptionPlan | Subscription plans | subscriptions | CURRENT | LOW | KEEP |
| 70 | CompanySubscription | Company subscriptions | company, plan | CURRENT | LOW | KEEP |
| 71 | Contract | Company contracts | company, milestones | CURRENT | MEDIUM — Float money | MIGRATE |
| 72 | Milestone | Contract milestones | contract | CURRENT | MEDIUM — Float money | MIGRATE |
| 73 | Payout | Provider payouts | user | CURRENT | LOW — BigInt | KEEP |
| 74 | MarketplaceJob | V2 marketplace jobs | matchQueue | CURRENT | LOW | KEEP |
| 75 | JobQuote | V2 provider quotes | none (scalar FKs) | CURRENT | LOW — BigInt | KEEP |
| 76 | JobEscrow | V2 payment escrow | none (scalar FKs) | CURRENT | CRITICAL — no transaction in cron | FIX |
| 77 | CommissionSettlement | Commission tracking | none (scalar FKs) | CURRENT | LOW — BigInt | KEEP |
| 78 | JobOtp | Job completion OTP | none (scalar jobId) | CURRENT | LOW | KEEP |
| 79 | ProviderWallet | Provider earnings | none (scalar userId) | CURRENT | CRITICAL — Float money | MIGRATE |
| 80 | CustomerWallet | Customer balance | none (scalar userId) | CURRENT | CRITICAL — Float money | MIGRATE |
| 81 | WalletTransaction | Wallet audit trail | none (scalar userId) | CURRENT | CRITICAL — Float money | MIGRATE |
| 82 | JobWorkspace | Job progress | none (scalar jobId) | CURRENT | LOW | KEEP |
| 83 | JobReview | V2 customer→provider reviews | none (scalar FKs) | CURRENT | LOW | KEEP |
| 84 | ProviderReview | V2 provider→customer reviews | none (scalar FKs) | CURRENT | LOW | KEEP |
| 85 | IdentityDocument | KYC documents | user | CURRENT | LOW | KEEP |
| 86 | AdminNotification | Admin notifications | none (scalar adminUserId) | CURRENT | LOW | KEEP |
| 87 | AdminRefreshToken | Admin refresh tokens | none (scalar adminUserId) | CURRENT | LOW | KEEP |
| 88 | AdminSession | Admin sessions | none (scalar adminUserId) | CURRENT | LOW | KEEP |
| 89 | AdminLoginAttempt | Admin login audit | none (scalar adminUserId) | CURRENT | LOW | KEEP |
| 90 | AuditLog | Admin audit trail | none (scalar adminUserId) | CURRENT | LOW | KEEP |
| 91 | AdminAlert | Admin work items | none | CURRENT | LOW | KEEP |
| 92 | PlatformSettings | Platform config | none | CURRENT | LOW | KEEP |
| 93 | FlashOffer | Landing page promos | none | CURRENT | LOW | KEEP |
| 94 | SeasonalOffer | Seasonal promotions | jobs | CURRENT | LOW | KEEP |
| 95 | SeasonalOfferJob | Seasonal job links | seasonalOffer, templateJob | CURRENT | LOW | KEEP |
| 96 | Country | Geography | states | CURRENT | LOW | KEEP |
| 97 | State | Geography | country, cities | CURRENT | LOW | KEEP |
| 98 | City | Geography | state, areas | CURRENT | LOW | KEEP |
| 99 | Area | Geography | city | CURRENT | LOW | KEEP |
| 100 | RealEstateListing | Property listings | none (scalar postedBy) | CURRENT | MEDIUM — Float money | MIGRATE |
| 101 | PropertyFavorite | Property favorites | none (scalar FKs) | CURRENT | LOW | KEEP |
| 102 | PropertyInquiry | Property inquiries | none (scalar FKs) | CURRENT | LOW | KEEP |
| 103 | PropertyBoost | Property boost payments | none (scalar FKs) | CURRENT | MEDIUM — Float money, no tx | MIGRATE |
| 104 | PropertyLocation | Property locations | none | CURRENT | LOW | KEEP |
| 105 | PricingModel | AI pricing models | none | CURRENT | LOW | KEEP |
| 106 | HistoricalJobPrice | Price history | none | CURRENT | LOW | KEEP |
| 107 | RegionalPriceIndex | Market pricing | none | CURRENT | LOW | KEEP |
| 108 | PricingCache | Price cache | none | CURRENT | LOW | KEEP |
| 109 | ProviderAvailability | Provider schedules | none | CURRENT | LOW | KEEP |
| 110 | DemandForecast | Demand predictions | none | CURRENT | LOW — dead code | REVIEW |
| 111 | SearchLog | Search analytics | none | CURRENT | LOW | KEEP |
| 112 | QualityMetric | Provider quality | none | CURRENT | LOW — never consumed | REVIEW |
| 113 | CustomerTrustScore | Customer trust | none | CURRENT | LOW — never used in logic | REVIEW |
| 114 | ProviderPerformance | Per-category stats | none | CURRENT | LOW | KEEP |
| 115 | PlatformAnalytics | Platform metrics | none | CURRENT | LOW | KEEP |
| 116 | LearningModelVersion | ML versioning | none | CURRENT | LOW | KEEP |
| 117 | CategoryDemand | Demand stats | none | CURRENT | LOW | KEEP |
| 118 | ProviderJobResponse | Response tracking | none (scalar FKs) | CURRENT | LOW | KEEP |
| 119 | WeeklySettlement | Weekly settlements | commissionPayments | CURRENT | MEDIUM — Float money | MIGRATE |
| 120 | CommissionPayment | Commission payments | weeklySettlement | CURRENT | MEDIUM — Float money | MIGRATE |
| 121 | OffPlatformDeal | Fraud reports | none (scalar FKs) | CURRENT | LOW | KEEP |
| 122 | WishlistItem | Internal wishlist | none | CURRENT | LOW | KEEP |
| 123 | WaitlistEntry | Waitlist signups | none | CURRENT | LOW | KEEP |

## Monetary Fields Inventory

### Float Money (CRITICAL — needs migration to BigInt)

| Model | Field | Risk |
|---|---|---|
| ProviderWallet | availableBalance | Balance precision loss |
| ProviderWallet | pendingBalance | Balance precision loss |
| CustomerWallet | balance | Balance precision loss |
| WalletTransaction | amount | Transaction precision loss |
| WalletTransaction | balanceBefore | Audit trail inaccuracy |
| WalletTransaction | balanceAfter | Audit trail inaccuracy |
| Invoice | subtotal, tax, total, amountPaid | Financial precision loss |
| InvoiceItem | quantity, unitPrice, totalPrice | Line item precision loss |
| Quotation | subtotal, tax, total | Financial precision loss |
| QuotationItem | quantity, unitPrice, totalPrice | Line item precision loss |
| WeeklySettlement | totalEarnings, commissionOwed | Settlement precision loss |
| CommissionPayment | amountDue | Payment precision loss |
| Contract | value | Contract value precision loss |
| Milestone | amount | Milestone payment precision loss |
| PropertyBoost | amount | Payment precision loss |
| Service | price | Display price (acceptable) |
| Booking | totalPrice, budgetMin, budgetMax | Legacy (acceptable) |
| TemplateJob | priceMin, priceMax | Range display (acceptable) |
| ServiceTemplate | priceMin, priceMax | Range display (acceptable) |
| PricingModel | baseRate, travelCostPerKm, materialCostFactor | Model weights (acceptable) |
| HistoricalJobPrice | finalPrice, estimatedPrice, budgetAmount, materialCost | History (acceptable) |
| RegionalPriceIndex | avgPrice, minPrice, maxPrice, medianPrice | Statistics (acceptable) |
| ProviderPerformance | totalEarnings, avgEarnings | Stats (acceptable) |
| CustomerProfile | totalSpent, lifetimeValue | CRM stats (acceptable) |

### BigInt Money (Correct)

| Model | Field |
|---|---|
| JobEscrow | amount, serviceFee, totalAmount |
| JobQuote | price |
| CommissionSettlement | jobAmount, commissionAmount |
| Payout | amount |
| MarketplaceJob | budgetAmount |
| PlatformSettings | minJobAmountCents, maxJobAmountCents |

### Int Money (Acceptable but inconsistent)

| Model | Field |
|---|---|
| PayoutRequest | amount |
| OfferTemplate | priceLkr |
| PlatformSettings | platformFeeBps |
