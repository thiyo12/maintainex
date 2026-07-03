export interface CategoryGroup {
  id: string
  name: string
  i18nKey: string
  icon: string
  color: string
  bgColor: string
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'home-repairs', name: 'Home Repairs', i18nKey: 'categories.homeRepairs', icon: 'hammer', color: '#2563EB', bgColor: '#EFF6FF' },
  { id: 'cleaning', name: 'Cleaning', i18nKey: 'categories.cleaning', icon: 'sparkles', color: '#059669', bgColor: '#ECFDF5' },
  { id: 'hvac', name: 'HVAC', i18nKey: 'categories.hvac', icon: 'thermometer', color: '#D97706', bgColor: '#FFFBEB' },
  { id: 'gardening', name: 'Gardening', i18nKey: 'categories.gardening', icon: 'leaf', color: '#16A34A', bgColor: '#F0FDF4' },
  { id: 'moving-delivery', name: 'Moving & Delivery', i18nKey: 'categories.movingDelivery', icon: 'truck', color: '#7C3AED', bgColor: '#F5F3FF' },
  { id: 'security', name: 'Security', i18nKey: 'categories.security', icon: 'shield-check', color: '#DC2626', bgColor: '#FEF2F2' },
  { id: 'automotive', name: 'Automotive', i18nKey: 'categories.automotive', icon: 'car', color: '#0891B2', bgColor: '#ECFEFF' },
  { id: 'it-services', name: 'IT Services', i18nKey: 'categories.itServices', icon: 'monitor', color: '#6366F1', bgColor: '#EEF2FF' },
]
