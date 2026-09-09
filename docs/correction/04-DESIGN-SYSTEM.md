# MaintainEX Design System Audit

## Color System

### Primary Palette
| Name | Hex | Usage |
|---|---|---|
| Amber 500 | `#F59E0B` | Primary buttons, active states, accents |
| Emerald 500 | `#10B981` | Success, completion, earnings |
| Red 500 | `#EF4444` | Error, danger, deletion |
| Blue 400 | `#60A5FA` | Info, links, secondary |
| Indigo 400 | `#818CF8` | Alternates, special features |

### Neutral Palette
| Name | Hex | Usage |
|---|---|---|
| Black | `#08080E` | Page background |
| Near Black | `#12121A` | Card backgrounds |
| Dark | `#1A1A25` | Elevated surfaces |
| Darker | `#252530` | Borders, dividers |
| Gray 400 | `#9CA3AF` | Secondary text |
| Gray 600 | `#4B5563` | Muted text, placeholders |
| White | `#FFFFFF` | Primary text, headings |

### Gradients
```typescript
amberGradient = ['#D97706', '#F59E0B', '#FBBF24']  // Buttons
goldGradient = ['#B8860B', '#D4A843', '#E8C547', '#D4A843', '#B8860B']  // Logo
loadingGradient = ['#F59E0B', '#FBBF24', '#FDE68A', '#FBBF24', '#F59E0B']  // Loading
```

### Badge Colors
| Status | Background | Text |
|---|---|---|
| Active/Online | `#059669` | `#D1FAE5` |
| Pending/Warning | `#D97706` | `#FEF3C7` |
| Inactive/Offline | `#4B5563` | `#F3F4F6` |
| Danger/Blocked | `#DC2626` | `#FEE2E2` |
| Primary/Featured | `#7C3AED` | `#EDE9FE` |

## Typography

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| Hero Title | Outfit | 28px | Bold | White |
| Section Title | Outfit | 16px | SemiBold | White |
| Card Title | Outfit | 14px | SemiBold | White |
| Body | Outfit | 14px | Regular | White/Gray-400 |
| Caption | Outfit | 12px | Regular | Gray-600 |
| Button Text | Outfit | 14-16px | SemiBold | White |
| Tab Label | Outfit | 10px | SemiBold | Gray-400 (active: Amber) |

## Spacing System

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon gaps, small padding |
| sm | 8px | Component internal spacing |
| md | 12px | Card padding, list gaps |
| lg | 16px | Screen padding, section gaps |
| xl | 24px | Major section gaps |
| 2xl | 32px | Screen top padding |

## Border Radius

| Token | Value | Usage |
|---|---|---|
| sm | 8px | Inputs, small cards |
| md | 12px | Cards, buttons |
| lg | 16px | Large cards, modals |
| xl | 20px | Feature cards |
| 2xl | 24px | Hero sections |
| full | 9999px | Avatars, pills, badges |

## Shadows

| Level | Value |
|---|---|
| sm | `shadow-sm: #000` |
| md | `shadow-md: #000` |
| lg | `shadow-lg: #000` |
| amber glow | `shadow-amber: #F59E0B` (opacity 0.15) |
| emerald glow | `shadow-emerald: #10B981` (opacity 0.15) |

## Component Patterns

### Cards
- Background: `#1A1A25` with `borderColor: #252530`
- Border radius: 16px
- Padding: 16px
- Shadow: `shadow-lg`

### Buttons
- Background: `amberGradient` or `linear-gradient(to right, #D97706, #F59E0B)`
- Border radius: 12px
- Height: 48-56px
- Font: 14-16px SemiBold
- Active state: scale(0.98)
- Disabled: `opacity: 0.5`

### Inputs
- Background: `#12121A`
- Border: 1px solid `#252530`
- Border radius: 12px
- Height: 48px
- Placeholder color: `#4B5563`
- Focus border: `#F59E0B`

### Badges
- Background: status-specific color (20% opacity)
- Text: status-specific color
- Border radius: 9999px (pill)
- Font: 11px SemiBold
- Padding: 4px 10px

### Tab Bars
- Background: `#12121A`
- Active icon: `#F59E0B`
- Active label: `#F59E0B`
- Inactive: `#4B5563`
- Border top: `1px solid #252530`

## Animation Patterns

| Pattern | Usage |
|---|---|
| `Animated.spring` | Button press, card tap |
| `Animated.timing` | Screen transitions, loading |
| `LayoutAnimation` | List item changes |
| `withRepeat` | Loading spinners, pulse |
| `withSequence` | Stagger animations |
| Haptic impactAsync | Tab changes, critical actions |
