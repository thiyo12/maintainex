import { request } from './client'
import { Booking, Category, JobPosting, Bid, JobCategory, TemplateJob, FindTaskerResult } from '../lib/types'

// Categories & Services
export const categories = {
  list: () => request<Category[]>('/api/mobile/job-categories'),
  get: (slug: string) => request<Category>(`/api/mobile/job-categories/${slug}`),
}

// Jobs (marketplace)
export const jobs = {
  list: (params?: string) =>
    request<JobPosting[]>(`/api/mobile/jobs${params ? `?${params}` : ''}`),
  get: (id: string) => request<JobPosting>(`/api/mobile/jobs/${id}`),
  create: (data: any) =>
    request<JobPosting>('/api/mobile/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<JobPosting>(`/api/mobile/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/api/mobile/jobs/${id}`, { method: 'DELETE' }),
  bid: (jobId: string, data: { amount: number; message: string }) =>
    request<Bid>(`/api/mobile/jobs/${jobId}/bid`, { method: 'POST', body: JSON.stringify(data) }),
  assign: (jobId: string, taskerId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'ASSIGNED', taskerId }) }),
  start: (jobId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'IN_PROGRESS' }) }),
  complete: (jobId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'COMPLETED' }) }),
  cancel: (jobId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'CANCELLED' }) }),
}

// Find a Tasker - Job Categories & Template Jobs
export const jobCategories = {
  list: (country?: string) =>
    request<JobCategory[]>(`/api/mobile/job-categories${country ? `?country=${country}` : ''}`),
  get: (id: string) =>
    request<JobCategory>(`/api/mobile/job-categories/${id}`),
}

export const templateJobs = {
  listByCategory: (categoryId: string, country?: string) =>
    request<TemplateJob[]>(`/api/mobile/template-jobs?categoryId=${categoryId}${country ? `&country=${country}` : ''}`),
  get: (id: string) =>
    request<TemplateJob>(`/api/mobile/template-jobs/${id}`),
  search: (query: string) =>
    request<TemplateJob[]>(`/api/mobile/template-jobs/search?q=${encodeURIComponent(query)}`),
  popular: (country?: string) =>
    request<TemplateJob[]>(`/api/mobile/template-jobs/popular${country ? `?country=${country}` : ''}`),
}

export const findTasker = {
  search: (params: { jobId: string; latitude?: number; longitude?: number; maxDistance?: number; country?: string }) => {
    const qs = new URLSearchParams({ jobId: params.jobId })
    if (params.latitude) qs.set('latitude', params.latitude.toString())
    if (params.longitude) qs.set('longitude', params.longitude.toString())
    if (params.maxDistance) qs.set('maxDistance', params.maxDistance.toString())
    if (params.country) qs.set('country', params.country)
    return request<FindTaskerResult[]>(`/api/mobile/find-tasker?${qs.toString()}`)
  },
  getTaskerProfile: (taskerId: string) =>
    request<FindTaskerResult>(`/api/mobile/find-tasker/${taskerId}`),
}
