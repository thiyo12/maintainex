export interface PriceRange {
  min: number
  base: number
  max: number
}

export interface CategoryPricing {
  [serviceKey: string]: PriceRange
}

export interface PricingData {
  [categoryKey: string]: CategoryPricing
}

export const PRICING: PricingData = {
  cleaning: {
    residential: { min: 2500, base: 3500, max: 5000 },
    home: { min: 2500, base: 3500, max: 5000 },
    house: { min: 2500, base: 3500, max: 5000 },
    industrial: { min: 6000, base: 8000, max: 15000 },
    deep: { min: 5000, base: 7000, max: 12000 },
    office: { min: 4000, base: 5500, max: 8000 },
    commercial: { min: 4000, base: 5500, max: 8000 },
    'move-in': { min: 5500, base: 7500, max: 12000 },
    'move-out': { min: 5500, base: 7500, max: 12000 },
    'movein': { min: 5500, base: 7500, max: 12000 },
    'moveout': { min: 5500, base: 7500, max: 12000 },
    sofa: { min: 2500, base: 3000, max: 5000 },
    upholstery: { min: 2500, base: 3000, max: 5000 },
    carpet: { min: 3000, base: 3500, max: 6000 },
    rug: { min: 2500, base: 3000, max: 5000 },
    'post-party': { min: 4000, base: 5000, max: 8000 },
    postconstruction: { min: 8000, base: 12000, max: 20000 },
    'post-construction': { min: 8000, base: 12000, max: 20000 },
  },

  pestcontrol: {
    cockroach: { min: 2500, base: 3500, max: 5000 },
    termite: { min: 6000, base: 8000, max: 15000 },
    ant: { min: 2000, base: 2500, max: 4000 },
    insect: { min: 2000, base: 2500, max: 4000 },
    rodent: { min: 3000, base: 4000, max: 6000 },
    rat: { min: 3000, base: 4000, max: 6000 },
    general: { min: 2500, base: 3000, max: 5000 },
  },

  acservice: {
    general: { min: 3000, base: 3500, max: 5000 },
    service: { min: 3000, base: 3500, max: 5000 },
    repair: { min: 3500, base: 4500, max: 8000 },
    gas: { min: 4000, base: 5000, max: 8000 },
    'gas-topup': { min: 4000, base: 5000, max: 8000 },
    topup: { min: 4000, base: 5000, max: 8000 },
    installation: { min: 5000, base: 6000, max: 10000 },
    install: { min: 5000, base: 6000, max: 10000 },
    uninstallation: { min: 3000, base: 4000, max: 6000 },
  },

  repairs: {
    plumbing: { min: 1500, base: 2500, max: 5000 },
    pipe: { min: 2000, base: 3000, max: 6000 },
    leak: { min: 1500, base: 2000, max: 4000 },
    tap: { min: 1000, base: 1500, max: 3000 },
    toilet: { min: 2000, base: 2500, max: 5000 },
    electrical: { min: 2000, base: 3000, max: 6000 },
    wiring: { min: 3000, base: 5000, max: 10000 },
    switch: { min: 1000, base: 1500, max: 3000 },
    outlet: { min: 1000, base: 1500, max: 3000 },
    painting: { min: 3500, base: 5000, max: 15000 },
    minor: { min: 3000, base: 4000, max: 8000 },
    touchup: { min: 2000, base: 3000, max: 5000 },
    door: { min: 2000, base: 2500, max: 5000 },
    window: { min: 2000, base: 2500, max: 5000 },
    lock: { min: 1500, base: 2000, max: 4000 },
    furniture: { min: 3000, base: 4000, max: 8000 },
    home: { min: 2500, base: 3500, max: 7000 },
  },

  assembly: {
    furniture: { min: 2500, base: 3500, max: 6000 },
    crib: { min: 2000, base: 2500, max: 4000 },
    baby: { min: 2000, base: 2500, max: 4000 },
    desk: { min: 1500, base: 2000, max: 3500 },
    office: { min: 1500, base: 2000, max: 3500 },
    bookshelf: { min: 2000, base: 2500, max: 4000 },
    shelf: { min: 1500, base: 2000, max: 3500 },
    wardrobe: { min: 3000, base: 4000, max: 7000 },
    bed: { min: 2500, base: 3500, max: 6000 },
    table: { min: 1500, base: 2000, max: 3500 },
  },

  mounting: {
    tv: { min: 2500, base: 3000, max: 5000 },
    television: { min: 2500, base: 3000, max: 5000 },
    art: { min: 1000, base: 1500, max: 3000 },
    shelf: { min: 1000, base: 1500, max: 3000 },
    mirror: { min: 1500, base: 2000, max: 3500 },
    curtain: { min: 1500, base: 2000, max: 3500 },
    blinds: { min: 1000, base: 1500, max: 2500 },
    picture: { min: 800, base: 1200, max: 2500 },
    frame: { min: 800, base: 1200, max: 2500 },
    wall: { min: 1500, base: 2500, max: 5000 },
  },

  moving: {
    help: { min: 4000, base: 5000, max: 10000 },
    moving: { min: 4000, base: 5000, max: 10000 },
    heavy: { min: 2000, base: 3000, max: 6000 },
    lifting: { min: 2000, base: 3000, max: 6000 },
    furniture: { min: 2500, base: 3500, max: 6000 },
    removal: { min: 2500, base: 3500, max: 6000 },
    disposal: { min: 2000, base: 3000, max: 5000 },
    appliance: { min: 1500, base: 2000, max: 4000 },
    fridge: { min: 2000, base: 2500, max: 4000 },
    washing: { min: 2000, base: 2500, max: 4000 },
  },

  outdoor: {
    garden: { min: 2000, base: 3000, max: 5000 },
    landscaping: { min: 3000, base: 5000, max: 10000 },
    lawn: { min: 2000, base: 3000, max: 5000 },
    mowing: { min: 1500, base: 2000, max: 3500 },
    pool: { min: 3000, base: 4000, max: 6000 },
    swimming: { min: 3000, base: 4000, max: 6000 },
    gutter: { min: 1500, base: 2000, max: 3500 },
    tree: { min: 2500, base: 4000, max: 8000 },
    trimming: { min: 2000, base: 3000, max: 5000 },
  },

  watertank: {
    overhead: { min: 3000, base: 4000, max: 6000 },
    tank: { min: 3000, base: 4000, max: 6000 },
    underground: { min: 6000, base: 8000, max: 15000 },
    cleaning: { min: 3000, base: 4000, max: 8000 },
    disinfection: { min: 2000, base: 2500, max: 4000 },
  },

  disinfection: {
    home: { min: 4000, base: 5000, max: 8000 },
    office: { min: 6000, base: 8000, max: 15000 },
    vehicle: { min: 1500, base: 2000, max: 3500 },
    car: { min: 1500, base: 2000, max: 3500 },
    sanitization: { min: 2000, base: 3000, max: 5000 },
    covid: { min: 5000, base: 7000, max: 12000 },
  },

  homecare: {
    light: { min: 1000, base: 1500, max: 2500 },
    fixture: { min: 1000, base: 1500, max: 2500 },
    fan: { min: 1500, base: 2000, max: 3500 },
    ceiling: { min: 1500, base: 2000, max: 3500 },
    repair: { min: 2000, base: 3000, max: 5000 },
    fixing: { min: 2000, base: 3000, max: 5000 },
    unblocking: { min: 2500, base: 3500, max: 6000 },
    replacement: { min: 1500, base: 2500, max: 5000 },
  },

  trending: {
    'full-house': { min: 7000, base: 10000, max: 18000 },
    'fullhouse': { min: 7000, base: 10000, max: 18000 },
    'smart-home': { min: 3000, base: 4000, max: 8000 },
    'smarthome': { min: 3000, base: 4000, max: 8000 },
    'wall-art': { min: 2500, base: 3500, max: 6000 },
    'post-party': { min: 4000, base: 5000, max: 8000 },
  },
}

export const DEFAULT_PRICING: PriceRange = {
  min: 2000,
  base: 3000,
  max: 6000,
}

export function getCategoryForSlug(slug: string): string | null {
  const categoryMap: Record<string, string> = {
    assembly: 'assembly',
    mounting: 'mounting',
    moving: 'moving',
    cleaning: 'cleaning',
    outdoor: 'outdoor',
    repairs: 'repairs',
    trending: 'trending',
    pestcontrol: 'pestcontrol',
    acservice: 'acservice',
    watertank: 'watertank',
    disinfection: 'disinfection',
    homecare: 'homecare',
  }

  for (const [key, value] of Object.entries(categoryMap)) {
    if (slug.includes(key) || key.includes(slug)) {
      return value
    }
  }

  return null
}
