import { v2Request } from './v2-client'

export const v2Identity = {
  getStatus: () =>
    v2Request<{ identityStatus: string; documents: any[] }>('/api/mobile/v2/identity'),

  uploadDocument: (docType: string, side: string, imageUrl: string, fullName?: string) =>
    v2Request<{ document: any }>('/api/mobile/v2/identity', {
      method: 'POST',
      body: JSON.stringify({ docType, side, imageUrl, fullName }),
    }),
}
