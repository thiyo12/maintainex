# MaintainEX Complete Application Domain Map

## Domain Summary

| # | Domain | Prisma Models | API Routes | Mobile Screens | Web Pages |
|---|---|---|---|---|---|
| 1 | Authentication | User, Admin, AdminUser, Session, OTP, LoginActivity, PasswordResetToken, etc. | 16 routes | 12 screens | 3 pages |
| 2 | Identity/KYC | IdentityDocument, User.identityStatus | 4 routes | 3 screens | 1 page |
| 3 | Customer | CustomerProfile, CustomerAddress, CustomerTag, CustomerSegment, etc. | 8 routes | 10 screens | 5 components |
| 4 | Provider/Tasker | TaskerProfile, TaskerSkill, TaskerBadge, ProviderAvailability, etc. | 12 routes | 10 screens | 2 pages |
| 5 | Company | CompanyProfile, TeamMember, TeamInvite, CompanySpecialty | 8 routes | 12 screens | 1 page |
| 6 | Services/Categories | Category, Industry, Service, JobCategory, TemplateJob, ServiceTemplate | 16 routes | 6 screens | 12 pages |
| 7 | Booking (Legacy) | Booking | 6 routes | 2 screens | Admin panel |
| 8 | Jobs V1 (Deprecated) | JobPosting, Bid, Assignment, Dispute | 4 routes | 3 screens | Admin panel |
| 9 | Marketplace V2 (Primary) | MarketplaceJob, JobQuote, JobEscrow, JobWorkspace, JobOtp | 24 routes | 18 screens | Admin panel |
| 10 | Quotes/Bids | JobQuote, Bid | 2 routes | 4 screens | - |
| 11 | Payments/Wallets | ProviderWallet, CustomerWallet, WalletTransaction | 6 routes | 5 screens | 1 page |
| 12 | Escrow | JobEscrow | 4 routes | 2 screens | Admin page |
| 13 | Commission | CommissionSettlement, WeeklySettlement, CommissionPayment | 4 routes | 1 screen | 2 pages |
| 14 | Payouts | Payout, PayoutRequest | 2 routes | 1 screen | - |
| 15 | Reviews | Review, TaskerReview, JobReview, ProviderReview | 4 routes | 2 screens | - |
| 16 | Messaging | Conversation, ConversationParticipant, Message | 3 routes | Chat UI | - |
| 17 | Notifications | Notification | 3 routes | Push integration | - |
| 18 | File Uploads | (Cloudinary + local) | 6 routes | Upload UI | - |
| 19 | Pricing | PricingModel, HistoricalJobPrice, RegionalPriceIndex, PricingCache | 5 routes | Estimate UI | 1 component |
| 20 | Matching | JobMatchQueue, OfferMatchQueue | 2 routes + 2 crons | FindingTasker UI | - |
| 21 | Admin | AdminUser, AdminSession, AuditLog, AdminAlert, etc. | 28 routes | Mobile admin | 15+ pages |
| 22 | CRM | CustomerProfile, CustomerNote, CustomerActivity, CustomerCommunication | 8 routes | - | 5 components |
| 23 | Real Estate | RealEstateListing, PropertyFavorite, PropertyInquiry, PropertyBoost | 7 routes | 4 screens | - |
| 24 | Analytics | PlatformAnalytics, LearningModelVersion, DemandForecast | 1 route | - | Admin page |
| 25 | Security | IpBlock, FailedLogin, SecurityAudit, RateLimitLog, ApiKey | 6 routes | - | 3 pages |
| 26 | Cron/Background | 9 cron jobs | 9 routes | - | - |
| 27 | Settings | Settings, AppSetting, PlatformSettings | 2 routes | - | Admin page |
| 28 | Subscriptions | SubscriptionPlan, CompanySubscription | 2 routes | 1 screen | - |
| 29 | Contracts | Contract, Milestone | 2 routes | 2 screens | - |
| 30 | Fraud/Safety | FraudEvent, AdminFlag, OffPlatformDeal, CustomerTrustScore | 3 routes | - | 1 page |
