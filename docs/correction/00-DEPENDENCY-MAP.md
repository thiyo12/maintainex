# MaintainEX Dependency Map

## Root Dependencies (package.json)

### Core
| Package | Version | Purpose |
|---|---|---|
| `next` | ^14.2.25 | Web framework |
| `react` | ^18.3.1 | UI library |
| `react-dom` | ^18.3.1 | DOM rendering |
| `typescript` | ^5.4.5 | Type checking |

### Database
| Package | Version | Purpose |
|---|---|---|
| `@prisma/client` | ^5.14.0 | ORM client |
| `prisma` | ^5.14.0 | ORM CLI |

### Auth
| Package | Version | Purpose |
|---|---|---|
| `bcryptjs` | ^2.4.3 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT signing/verification |
| `otplib` | ^12.0.1 | TOTP 2FA |
| `next-auth` | ^4.24.7 | NextAuth (unused) |

### UI
| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | ^3.4.3 | Utility CSS |
| `@radix-ui/react-*` | Various | UI primitives |
| `lucide-react` | ^0.460.0 | Icons |
| `framer-motion` | ^11.18.0 | Animations |
| `recharts` | ^2.15.0 | Charts |

### Data
| Package | Version | Purpose |
|---|---|---|
| `zustand` | ^5.0.14 | State management |
| `@tanstack/react-query` | ^5.101.0 | Data fetching |
| `react-hook-form` | ^7.78.0 | Forms |
| `zod` | ^3.23.8 | Validation |

### Files
| Package | Version | Purpose |
|---|---|---|
| `cloudinary` | ^2.5.1 | File storage |
| `uuid` | ^11.1.0 | UUID generation |

### Utilities
| Package | Version | Purpose |
|---|---|---|
| `date-fns` | ^4.1.0 | Date formatting |
| `cannon` | ^6.0.2 | Physics (splash) |
| `confetti` | ^7.0.3 | Animations |
| `next-pwa` | ^5.6.0 | PWA support |
| `next-security-headers` | ^0.1.15 | Security headers |
| `request-ip` | ^3.0.1 | IP detection |
| `uuid` | ^11.1.0 | UUID generation |

### Dev Dependencies
| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^4.1.8 | Testing |
| `@vitejs/plugin-react` | ^4.5.2 | Vite React plugin |
| `eslint` | ^8.57.0 | Linting |
| `@types/*` | Various | Type definitions |

## Mobile Dependencies (apps/mobile/package.json)

### Core
| Package | Version | Purpose |
|---|---|---|
| `expo` | ~56.0.12 | Mobile framework |
| `react-native` | 0.85.3 | Mobile UI |
| `react` | 19.2.3 | UI library |
| `expo-router` | ~5.1.4 | File-based routing |

### UI
| Package | Version | Purpose |
|---|---|---|
| `react-native-reanimated` | ~3.17.12 | Animations |
| `react-native-gesture-handler` | ~2.24.6 | Gestures |
| `@expo/vector-icons` | ^14.0.0 | Icons |
| `expo-linear-gradient` | ~14.0.2 | Gradients |

### Storage
| Package | Version | Purpose |
|---|---|---|
| `expo-secure-store` | ~14.2.3 | Secure storage |
| `@react-native-async-storage/async-storage` | 2.1.2 | Local storage |

### Data
| Package | Version | Purpose |
|---|---|---|
| `@tanstack/react-query` | ^5.101.0 | Data fetching |
| `zustand` | ^5.0.14 | State management |
| `react-hook-form` | ^7.78.0 | Forms |
| `zod` | ^3.23.8 | Validation |

## Known Vulnerabilities

| Package | Issue | Severity |
|---|---|---|
| `next-auth` | Unused but installed | LOW |
| `bcryptjs` | No known vulnerabilities | OK |
| `jsonwebtoken` | Algorithm confusion if not verified | MEDIUM |
| `otplib` | No known vulnerabilities | OK |

## Recommendations

1. Remove unused `next-auth` package
2. Run `npm audit` regularly
3. Pin exact versions for production
4. Use `npm audit fix` for known vulnerabilities
