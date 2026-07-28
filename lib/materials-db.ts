export interface MaterialItem {
  name: string
  unitPrice: number
  unit: string
  source: string
  avgQuantity: number
}

export interface CategoryMaterials {
  materials: MaterialItem[]
  labourRange: { min: number; max: number }
  description: string
  hasMaterials: boolean
  quantityScaleKeywords?: Record<string, number>
}

export const MATERIALS_DB: Record<string, CategoryMaterials> = {
  painting: {
    materials: [
      { name: 'Nippon Paint — Interior (4L)', unitPrice: 2100, unit: 'tin', source: 'keells.com', avgQuantity: 4 },
      { name: 'Primer (2L)', unitPrice: 1050, unit: 'tin', source: 'keells.com', avgQuantity: 2 },
      { name: 'Rollers, brushes, tape, drop cloth', unitPrice: 1200, unit: 'set', source: 'estimated', avgQuantity: 1 },
    ],
    labourRange: { min: 15000, max: 22000 },
    description: 'Interior painting',
    hasMaterials: true,
    quantityScaleKeywords: {
      '1 bedroom': 0.5,
      '2 bedroom': 0.75,
      '3 bedroom': 1.0,
      '4 bedroom': 1.3,
      '5 bedroom': 1.6,
      'single room': 0.3,
      'two room': 0.6,
      'kitchen': 0.4,
      'bathroom': 0.3,
      'hall': 0.5,
      'living room': 0.5,
      'exterior': 1.8,
      'full house': 2.0,
      'whole house': 2.0,
      'apartment': 1.5,
      'office': 1.2,
      'commercial': 2.5,
    },
  },
  plumbing: {
    materials: [
      { name: 'PVC Pipe (1" × 3m)', unitPrice: 350, unit: 'piece', source: 'keells.com', avgQuantity: 4 },
      { name: 'Pipe fittings (elbow, tee, coupling)', unitPrice: 80, unit: 'piece', source: 'keells.com', avgQuantity: 6 },
      { name: 'Thread seal tape', unitPrice: 50, unit: 'roll', source: 'keells.com', avgQuantity: 2 },
      { name: 'Silicone sealant', unitPrice: 450, unit: 'tube', source: 'keells.com', avgQuantity: 1 },
    ],
    labourRange: { min: 2000, max: 8000 },
    description: 'Standard plumbing repair',
    hasMaterials: true,
    quantityScaleKeywords: {
      'leak': 0.4,
      'tap': 0.3,
      'faucet': 0.3,
      'toilet': 0.6,
      'sink': 0.5,
      'shower': 0.5,
      'pipe': 0.8,
      'full bathroom': 1.5,
      'renovation': 2.0,
      'whole house': 2.5,
    },
  },
  electrical: {
    materials: [
      { name: '2.5mm² Wire (100m)', unitPrice: 4500, unit: 'roll', source: 'keells.com', avgQuantity: 1 },
      { name: 'Conduit pipe (1" × 3m)', unitPrice: 120, unit: 'piece', source: 'keells.com', avgQuantity: 4 },
      { name: 'Switch/socket', unitPrice: 350, unit: 'piece', source: 'keells.com', avgQuantity: 3 },
      { name: 'MCB breaker', unitPrice: 800, unit: 'piece', source: 'keells.com', avgQuantity: 2 },
      { name: 'Junction box', unitPrice: 200, unit: 'piece', source: 'keells.com', avgQuantity: 3 },
    ],
    labourRange: { min: 2500, max: 10000 },
    description: 'Standard electrical work',
    hasMaterials: true,
    quantityScaleKeywords: {
      'fan': 0.3,
      'light': 0.2,
      'switch': 0.2,
      'socket': 0.3,
      'wiring': 1.2,
      'full room': 1.0,
      'rewiring': 2.5,
      'house wiring': 3.0,
      'panel': 1.5,
      'breaker': 0.5,
    },
  },
  ac: {
    materials: [
      { name: 'AC gas (R410A)', unitPrice: 3500, unit: 'kg', source: 'estimated', avgQuantity: 1 },
      { name: 'Copper pipe (1/2" × 3m)', unitPrice: 1800, unit: 'piece', source: 'keells.com', avgQuantity: 1 },
      { name: 'Insulation tape', unitPrice: 150, unit: 'roll', source: 'keells.com', avgQuantity: 2 },
    ],
    labourRange: { min: 3000, max: 8000 },
    description: 'AC servicing',
    hasMaterials: true,
    quantityScaleKeywords: {
      'service': 0.5,
      'gas': 0.6,
      'install': 1.0,
      'repair': 0.8,
      'clean': 0.4,
      '2 unit': 2.0,
      '3 unit': 3.0,
    },
  },
  moving: {
    materials: [
      { name: 'Packing boxes (medium)', unitPrice: 150, unit: 'piece', source: 'estimated', avgQuantity: 10 },
      { name: 'Bubble wrap (roll)', unitPrice: 800, unit: 'roll', source: 'estimated', avgQuantity: 1 },
      { name: 'Packing tape', unitPrice: 200, unit: 'roll', source: 'estimated', avgQuantity: 2 },
    ],
    labourRange: { min: 5000, max: 15000 },
    description: 'Standard move',
    hasMaterials: true,
    quantityScaleKeywords: {
      '1 bedroom': 0.6,
      '2 bedroom': 1.0,
      '3 bedroom': 1.5,
      '4 bedroom': 2.0,
      'office': 1.8,
      'small': 0.5,
      'large': 2.0,
      'floor': 0.3,
    },
  },
  carpentry: {
    materials: [
      { name: 'Wood screws (box)', unitPrice: 300, unit: 'box', source: 'keells.com', avgQuantity: 1 },
      { name: 'Wood glue', unitPrice: 250, unit: 'bottle', source: 'keells.com', avgQuantity: 1 },
      { name: 'Sandpaper (pack)', unitPrice: 150, unit: 'pack', source: 'keells.com', avgQuantity: 2 },
      { name: 'Wood filler', unitPrice: 400, unit: 'tube', source: 'keells.com', avgQuantity: 1 },
    ],
    labourRange: { min: 3000, max: 12000 },
    description: 'Standard carpentry work',
    hasMaterials: true,
    quantityScaleKeywords: {
      'furniture': 1.0,
      'door': 0.8,
      'window': 0.7,
      'shelf': 0.5,
      'cabinet': 1.5,
      'repair': 0.5,
      'install': 0.8,
    },
  },
  gardening: {
    materials: [
      { name: 'Fertilizer (5kg)', unitPrice: 800, unit: 'bag', source: 'keells.com', avgQuantity: 1 },
      { name: 'Plant seeds (pack)', unitPrice: 200, unit: 'pack', source: 'estimated', avgQuantity: 2 },
    ],
    labourRange: { min: 2000, max: 6000 },
    description: 'Standard gardening',
    hasMaterials: false,
  },
  cleaning: {
    materials: [],
    labourRange: { min: 2000, max: 5000 },
    description: 'Standard cleaning',
    hasMaterials: false,
  },
  repairs: {
    materials: [
      { name: 'Basic hardware (screws, nails, brackets)', unitPrice: 500, unit: 'set', source: 'estimated', avgQuantity: 1 },
      { name: 'Adhesive/sealant', unitPrice: 400, unit: 'tube', source: 'keells.com', avgQuantity: 1 },
    ],
    labourRange: { min: 2000, max: 8000 },
    description: 'Standard repair',
    hasMaterials: true,
    quantityScaleKeywords: {
      'small': 0.5,
      'medium': 1.0,
      'large': 1.5,
      'furniture': 0.8,
      'wall': 0.6,
      'door': 0.7,
    },
  },
  assembly: {
    materials: [
      { name: 'Hardware pack (bolts, nuts, brackets)', unitPrice: 400, unit: 'set', source: 'estimated', avgQuantity: 1 },
    ],
    labourRange: { min: 2000, max: 6000 },
    description: 'Furniture assembly',
    hasMaterials: false,
  },
  renovation: {
    materials: [
      { name: 'Cement (50kg)', unitPrice: 1200, unit: 'bag', source: 'keells.com', avgQuantity: 5 },
      { name: 'Sand (cubic ft)', unitPrice: 300, unit: 'load', source: 'estimated', avgQuantity: 3 },
      { name: 'Bricks', unitPrice: 60, unit: 'piece', source: 'estimated', avgQuantity: 50 },
      { name: 'Tiles (sq ft)', unitPrice: 400, unit: 'piece', source: 'keells.com', avgQuantity: 10 },
      { name: 'Grout', unitPrice: 600, unit: 'bag', source: 'keells.com', avgQuantity: 2 },
    ],
    labourRange: { min: 25000, max: 80000 },
    description: 'Renovation work',
    hasMaterials: true,
    quantityScaleKeywords: {
      'kitchen': 1.5,
      'bathroom': 1.2,
      'room': 1.0,
      'floor': 1.3,
      'wall': 0.8,
      'full': 2.5,
      'small': 0.6,
      'large': 1.8,
    },
  },
  automotive: {
    materials: [],
    labourRange: { min: 3000, max: 10000 },
    description: 'Automotive service',
    hasMaterials: false,
  },
  digital: {
    materials: [],
    labourRange: { min: 5000, max: 25000 },
    description: 'Digital service',
    hasMaterials: false,
  },
  pest: {
    materials: [
      { name: 'Pest control spray', unitPrice: 800, unit: 'bottle', source: 'estimated', avgQuantity: 2 },
      { name: 'Bait stations', unitPrice: 300, unit: 'piece', source: 'estimated', avgQuantity: 4 },
    ],
    labourRange: { min: 3000, max: 8000 },
    description: 'Pest control treatment',
    hasMaterials: true,
    quantityScaleKeywords: {
      'small': 0.6,
      'medium': 1.0,
      'large': 1.5,
      'full house': 2.0,
      'garden': 1.3,
    },
  },
  other: {
    materials: [],
    labourRange: { min: 2000, max: 8000 },
    description: 'General service',
    hasMaterials: false,
  },
}
