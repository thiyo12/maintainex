// COMPATIBILITY SHIM — canonical mobile v2 API adapter lives in apps/mobile/api/*
// Registered for Phase H retirement (callers migrate to @/api/<domain>).

export { v2Request } from '../api/v2-client'
export { V2Escrow, V2Workspace, V2CompanyAssignment, V2ProviderSummary, V2Quote, V2Job, V2PaymentStatus, SubTask, PriceBreakdownItem, MarketInsight, DetectedMaterial, PriceEstimate, SmartQuestionOption, SmartQuestion, SmartTemplate, SmartPriceEstimate, SearchResult, AvailabilityResult, QualityResult, TrustResult, ScheduleRecommendation, CustomJobRequestInput, CustomJobRequest, InspectionInput, EvidenceInput, ChangeOrderInput, TaskerProfileResult } from '../api/v2-types'
export { v2Locations, v2Jobs, v2JobActions, v2Match, v2SubTasks, v2CustomJobs, v2Inspection, v2Evidence, v2ChangeOrder } from '../api/v2-jobs'
export { v2Quotes } from '../api/v2-quotes'
export { v2Payments } from '../api/v2-payments'
export { v2Wallet } from '../api/v2-wallet'
export { v2Team, v2Subscription } from '../api/v2-companies'
export { v2Identity } from '../api/v2-identity'
export { offerProgram } from '../api/v2-offers'
export { v2Pricing, v2SmartBooking } from '../api/v2-pricing'
export { v2Search } from '../api/v2-search'
export { v2Availability, v2Quality, v2Trust, v2Schedule, v2TaskerProfile } from '../api/v2-taskers'
