import { v2Request } from './v2-client'

export const v2Identity = {
  getStatus: () =>
    v2Request<{ identityStatus: string; documents: any[] }>('/api/mobile/v2/identity'),

  uploadDocument: (docType: string, side: string, imageUrl: string, fullName?: string) =>
    v2Request<{ document: any }>('/api/mobile/v2/identity', {
      method: 'POST',
      body: JSON.stringify({ docType, side, imageUrl, fullName }),
    }),

  getPhotoChangeStatus: () =>
    v2Request<{
      identityVerified: boolean
      verifiedPhotoUrl: string | null
      photoLocked: boolean
      pendingRequest: null | {
        id: string
        requestedPhotoUrl: string
        status: string
        livenessStatus: string
        faceMatchStatus: string
        createdAt: string
      }
    }>('/api/mobile/v2/identity/photo-change'),

  requestPhotoChange: (requestedPhotoUrl: string, requestReason?: string) =>
    v2Request<{
      request: {
        id: string
        status: string
        livenessStatus: string
        faceMatchStatus: string
        createdAt: string
      }
      created: boolean
    }>('/api/mobile/v2/identity/photo-change', {
      method: 'POST',
      body: JSON.stringify({ requestedPhotoUrl, requestReason }),
    }),
}
