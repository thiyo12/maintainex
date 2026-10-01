import { Sparkle, Lightning, Drop, Snowflake, Palette, Laptop, Wrench, PaintBrush, Hammer, SquaresFour, Wall, House, Bug, Leaf, Lock, Truck, Car, Desktop, Gift, HandHeart, HouseSimple, Sun, Icon, FrameCorners, TShirt, Television } from 'phosphor-react-native'

export interface CategoryVisual {
  id: string
  icon: Icon
  lottie?: string
  gradient: [string, string]
}

export const CATEGORY_VISUALS: CategoryVisual[] = [
  {
    id: 'cleaning',
    icon: Sparkle,
    lottie: 'https://assets5.lottiefiles.com/packages/lf20_4kx2q32n.json',
    gradient: ['#0EA5E9', '#1D4ED8'],
  },
  {
    id: 'electrical',
    icon: Lightning,
    gradient: ['#F59E0B', '#EA580C'],
  },
  {
    id: 'plumbing',
    icon: Drop,
    lottie: 'https://assets2.lottiefiles.com/packages/lf20_jcikwtux.json',
    gradient: ['#06B6D4', '#0E7490'],
  },
  {
    id: 'ac',
    icon: Snowflake,
    gradient: ['#6366F1', '#4338CA'],
  },
  {
    id: 'painting',
    icon: Palette,
    lottie: 'https://assets4.lottiefiles.com/packages/lf20_ystsffqy.json',
    gradient: ['#EC4899', '#A21CAF'],
  },
  {
    id: 'general',
    icon: Wrench,
    lottie: 'https://assets6.lottiefiles.com/packages/lf20_myejiggj.json',
    gradient: ['#10B981', '#047857'],
  },
]

export const CATEGORY_ICON_FALLBACK: Record<string, Icon> = {
  cleaning: Sparkle,
  electrical: Lightning,
  plumbing: Drop,
  ac: Snowflake,
  painting: Palette,
  digital: Laptop,
  general: Wrench,
}

export const CATEGORY_SLUG_ICON: Record<string, Icon> = {
  'electrical-works': Lightning,
  plumbing: Drop,
  'ac-and-refrigeration': Snowflake,
  'painting-and-decorating': PaintBrush,
  'carpentry-and-furniture': Hammer,
  'tiling-and-flooring': SquaresFour,
  'masonry-and-concrete': Wall,
  'roofing-and-gutters': House,
  'pest-control': Bug,
  'cleaning-services': Sparkle,
  'gardening-and-landscaping': Leaf,
  'home-security-and-automation': Lock,
  'moving-and-packing': Truck,
  'vehicle-care-and-maintenance': Car,
  'it-and-electronics-repair': Desktop,
  'event-and-party-services': Gift,
  'personal-care-and-wellness': HandHeart,
  'home-renovation-and-interiors': HouseSimple,
  'solar-and-energy-solutions': Sun,
  'handyman-and-general-repairs': Wrench,
  'glass-and-aluminium': FrameCorners,
  'appliance-installation-and-repair': Television,
  'locksmith-services': Lock,
  'curtains-blinds-and-upholstery': TShirt,
}

export const CATEGORY_SLUG_GRADIENT: Record<string, [string, string]> = {
  'electrical-works': ['#F59E0B', '#EA580C'],
  plumbing: ['#06B6D4', '#0E7490'],
  'ac-and-refrigeration': ['#6366F1', '#4338CA'],
  'painting-and-decorating': ['#EC4899', '#A21CAF'],
  'carpentry-and-furniture': ['#B45309', '#78350F'],
  'tiling-and-flooring': ['#0EA5E9', '#1D4ED8'],
  'masonry-and-concrete': ['#64748B', '#334155'],
  'roofing-and-gutters': ['#F97316', '#C2410C'],
  'pest-control': ['#84CC16', '#4D7C0F'],
  'cleaning-services': ['#0EA5E9', '#1D4ED8'],
  'gardening-and-landscaping': ['#22C55E', '#15803D'],
  'home-security-and-automation': ['#8B5CF6', '#5B21B6'],
  'moving-and-packing': ['#F59E0B', '#B45309'],
  'vehicle-care-and-maintenance': ['#3B82F6', '#1E40AF'],
  'it-and-electronics-repair': ['#14B8A6', '#0F766E'],
  'event-and-party-services': ['#EC4899', '#BE185D'],
  'personal-care-and-wellness': ['#F472B6', '#BE185D'],
  'home-renovation-and-interiors': ['#A16207', '#713F12'],
  'solar-and-energy-solutions': ['#EAB308', '#CA8A04'],
  'handyman-and-general-repairs': ['#475569', '#334155'],
  'glass-and-aluminium': ['#0369A1', '#075985'],
  'appliance-installation-and-repair': ['#B45309', '#92400E'],
  'locksmith-services': ['#3F3F46', '#27272A'],
  'curtains-blinds-and-upholstery': ['#DB2777', '#BE185D'],
}

export interface CategoryFallback {
  id: string
  slug: string
  name: string
}

export const CATEGORY_FALLBACK: CategoryFallback[] = [
  { id: 'cmq11mmga0000au6t7lriksk3', slug: 'electrical-works', name: 'Electrical Works' },
  { id: 'cmq11mmhz0001au6tx65rlca0', slug: 'plumbing', name: 'Plumbing' },
  { id: 'cmq11mmj00002au6tqnnedkzs', slug: 'ac-and-refrigeration', name: 'AC and Refrigeration' },
  { id: 'cmq11mmjt0003au6tgd86dua9', slug: 'painting-and-decorating', name: 'Painting and Decorating' },
  { id: 'cmq11mmkk0004au6tfpvqt403', slug: 'carpentry-and-furniture', name: 'Carpentry and Furniture' },
  { id: 'cmq11mmkz0005au6tyc75eg8x', slug: 'tiling-and-flooring', name: 'Tiling and Flooring' },
  { id: 'cmq11mmlb0006au6tjgu3fc77', slug: 'masonry-and-concrete', name: 'Masonry and Concrete' },
  { id: 'cmq11mmls0007au6tejrellmd', slug: 'roofing-and-gutters', name: 'Roofing and Gutters' },
  { id: 'cmq11mmm40008au6tb1chtxse', slug: 'pest-control', name: 'Pest Control' },
  { id: 'cmq11mmme0009au6tz4ilxt3n', slug: 'cleaning-services', name: 'Cleaning Services' },
  { id: 'cmq11mmms000aau6tw8l1635y', slug: 'gardening-and-landscaping', name: 'Gardening and Landscaping' },
  { id: 'cmq11mmn4000bau6tx4pjvqzu', slug: 'home-security-and-automation', name: 'Home Security and Automation' },
  { id: 'cmq11mmng000cau6to6u5pfcw', slug: 'moving-and-packing', name: 'Moving and Packing' },
  { id: 'cmq11mmnq000dau6t6rhtyb9w', slug: 'vehicle-care-and-maintenance', name: 'Vehicle Care and Maintenance' },
  { id: 'cmq11mmo1000eau6t8rv561up', slug: 'it-and-electronics-repair', name: 'IT and Electronics Repair' },
  { id: 'cmq11mmog000fau6ty5r27yw8', slug: 'event-and-party-services', name: 'Event and Party Services' },
  { id: 'cmq11mmor000gau6t44fkq9r8', slug: 'personal-care-and-wellness', name: 'Personal Care and Wellness' },
  { id: 'cmq11mmp2000hau6txbqrhsn5', slug: 'home-renovation-and-interiors', name: 'Home Renovation and Interiors' },
  { id: 'cmq11mmph000iau6tuxaq64qg', slug: 'solar-and-energy-solutions', name: 'Solar and Energy Solutions' },
  { id: 'cmtilkh0z00a79z5q737mmpfm', slug: 'handyman-and-general-repairs', name: 'Handyman and General Repairs' },
  { id: 'cmtilkh3b00bi9z5qt16axea0', slug: 'glass-and-aluminium', name: 'Glass and Aluminium' },
  { id: 'cmtilkh4i00c59z5qbnfgkpkr', slug: 'appliance-installation-and-repair', name: 'Appliance Installation and Repair' },
  { id: 'cmtilkh5v00cu9z5qu0pbw6o9', slug: 'locksmith-services', name: 'Locksmith Services' },
  { id: 'cmtilkh6t00dd9z5qzge5lmnv', slug: 'curtains-blinds-and-upholstery', name: 'Curtains, Blinds and Upholstery' },
]

export function categoryVisualBySlug(slug?: string | null): { icon: Icon; gradient: [string, string] } {
  const key = (slug || '').toLowerCase()
  return {
    icon: CATEGORY_SLUG_ICON[key] || CATEGORY_ICON_FALLBACK[key] || Wrench,
    gradient: CATEGORY_SLUG_GRADIENT[key] || ['#10B981', '#047857'],
  }
}

export function categoryIcon(id?: string | null): Icon {
  return (id ? CATEGORY_ICON_FALLBACK[id] : undefined) || Wrench
}