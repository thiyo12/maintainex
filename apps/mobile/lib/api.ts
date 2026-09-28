// COMPATIBILITY SHIM — canonical mobile v1 API adapter lives in apps/mobile/api/*
// Registered for Phase H retirement (callers migrate to @/api/<domain>).

export { setAuthToken, getAuthToken } from '../api/token'
export { resolveImageUri } from '../api/client'
export { auth } from '../api/auth'
export { categories, jobs, jobCategories, templateJobs, findTasker } from '../api/jobs'
export { bookings, quickBookings } from '../api/bookings'
export { taskers, skillsApi } from '../api/taskers'
export { notifications } from '../api/notifications'
export { conversations } from '../api/messaging'
export { disputes } from '../api/disputes'
export { getActiveCompanyContext, getActiveCompanyId, company } from '../api/companies'
export type { ActiveCompanyContext } from '../api/companies'
export { earnings } from '../api/payments'
export { search } from '../api/search'
export { upload } from '../api/upload'
export { seasonalOffers, serviceCategories } from '../api/offers'
export { realEstate } from '../api/real-estate'
