const iconMap: Record<string, string> = {
  flash: 'flash-outline',
  water: 'water-outline',
  snowflake: 'snowflake-outline',
  'color-palette': 'color-palette-outline',
  hammer: 'hammer-outline',
  grid: 'grid-outline',
  construct: 'construct-outline',
  home: 'home-outline',
  bug: 'bug-outline',
  sparkles: 'sparkles-outline',
  leaf: 'leaf-outline',
  'lock-closed': 'lock-closed-outline',
  car: 'car-outline',
  'car-sport': 'car-sport-outline',
  desktop: 'desktop-outline',
  'musical-notes': 'musical-notes-outline',
  body: 'body-outline',
  business: 'business-outline',
  sunny: 'sunny-outline',
}

export function getCategoryIcon(iconName: string): string {
  return iconMap[iconName] || 'construct-outline'
}
