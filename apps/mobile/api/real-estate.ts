import { request } from './client'
export const realEstate = {
  list: (params?: { type?: string; status?: string; country?: string; [key: string]: any }) =>
    request<any[]>(`/api/properties?${new URLSearchParams(params || {}).toString()}`),

  get: (id: string) =>
    request<any>(`/api/properties/${id}`),

  create: (data: any) => request<any>(`/api/properties`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => request<any>(`/api/properties/${id}`, {
    method: 'PUT', body: JSON.stringify(data),
  }),

  delete: (id: string) => request<any>(`/api/properties/${id}`, {
    method: 'DELETE',
  }),

  submit: (id: string) => request<any>(`/api/properties/${id}/submit`, {
    method: 'POST',
  }),

  boost: (id: string, tier: string, paymentMethod: string = 'wallet') =>
    request<any>(`/api/properties/${id}/boost`, {
      method: 'POST', body: JSON.stringify({ tier, paymentMethod }),
    }),

  favorite: (id: string) => request<any>(`/api/properties/${id}/favorite`, {
    method: 'POST',
  }),

  favorites: () => request<any>(`/api/properties/favorites`),

  inquiry: (id: string, data: { type?: string; message?: string }) =>
    request<any>(`/api/properties/${id}/inquiry`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  priceEstimate: (data: any) => request<any>(`/api/properties/price-estimate`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  myListings: (params?: any) =>
    request<any>(`/api/properties?myOnly=true&${new URLSearchParams(params || {}).toString()}`),
}
