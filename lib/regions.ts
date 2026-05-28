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
    districts: [
      'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
      'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
      'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
      'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
      'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
    ],
    budgetMax: 100000,
    budgetStep: 500,
  },
  CA: {
    label: 'Canada',
    currency: 'CAD',
    currencySymbol: '$',
    phone: '+1 (416) 427-9518',
    phoneRaw: '14164279518',
    email: 'maintainex.canada@gmail.com',
    whatsapp: '14164279518',
    districts: [
      'Toronto (Downtown)', 'Scarborough', 'North York', 'Etobicoke',
      'York', 'East York', 'Mississauga', 'Brampton',
      'Markham', 'Richmond Hill', 'Vaughan', 'Oakville',
      'Burlington', 'Milton', 'Ajax', 'Pickering',
      'Whitby', 'Oshawa', 'Newmarket', 'Aurora',
    ],
    budgetMax: 5000,
    budgetStep: 50,
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
