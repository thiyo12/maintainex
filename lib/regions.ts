export interface RegionConfig {
  label: string
  currency: string
  currencySymbol: string
  phone: string
  phoneRaw: string
  email: string
  whatsapp: string
  districts: string[]
  budgetMax: number
  budgetStep: number
  countryName: string
  countryNamePossessive: string
  phoneExample: string
  phoneHint: string
}

export const REGIONS: Record<string, RegionConfig> = {
  LK: {
    label: 'Sri Lanka',
    currency: 'LKR',
    currencySymbol: 'LKR',
    phone: '0770867609',
    phoneRaw: '94770867609',
    email: 'maintainex.lk@gmail.com',
    whatsapp: '94770867609',
    countryName: 'Sri Lanka',
    countryNamePossessive: "Sri Lanka's",
    districts: [
      'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
      'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
      'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
      'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
      'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
    ],
    budgetMax: 100000,
    budgetStep: 500,
    phoneExample: '0712345678',
    phoneHint: 'Enter 9-10 digits (mobile) or more (with country code)',
  },
  CA: {
    label: 'Canada',
    currency: 'CAD',
    currencySymbol: '$',
    phone: '+1 (416) 427-9518',
    phoneRaw: '14164279518',
    email: 'maintainex.canada@gmail.com',
    whatsapp: '14164279518',
    countryName: 'Canada',
    countryNamePossessive: "Canada's",
    // Canadian launch scope: Vancouver municipal limits only.
    // This UI list is not a geofence; booking authorization must validate
    // the confirmed service coordinates against Vancouver city boundaries.
    districts: ['Vancouver'],
    budgetMax: 5000,
    budgetStep: 50,
    phoneExample: '+1 416 555 0123',
    phoneHint: 'Enter 10 digits (mobile) or more (with country code)',
  },
}

export type Region = keyof typeof REGIONS

export function getRegionFromHost(host: string): Region {
  if (host.includes('ca.')) return 'CA'
  return 'LK'
}

export function getDistricts(region: Region): string[] {
  return REGIONS[region]?.districts || REGIONS.LK.districts
}
