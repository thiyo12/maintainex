# MaintainEX Mobile App Audit

## Expo Configuration

| Property | Value |
|---|---|
| SDK | ~56.0.12 |
| React Native | 0.85.3 |
| React | 19.2.3 |
| TypeScript | ~6.0.3 |
| Router | File-based (expo-router) |
| Splash | `assets/splash.png` (1254×1254) |
| Icon | `assets/icon.png` (1024×1024) |
| Adaptive Icon | `assets/adaptive-icon.png` (1024×1024) |
| Safe Area | Enabled in all layouts |
| Status Bar | `light-content` on dark backgrounds |

## Screen Inventory

### Auth Flow
| Screen | File | Purpose |
|---|---|---|
| Splash | `app/index.tsx` | Auto-login check + navigation |
| Welcome | `app/welcome.tsx` | Onboarding CTA |
| Login | `app/login.tsx` | Phone/password + OTP option |
| Register | `app/register.tsx` | Registration (requires OTP) |
| OTP Verify | `app/otp-verify.tsx` | 6-digit OTP input |
| OTP Login | `components/auth/OtpLoginModal.tsx` | OTP-only login |

### Customer Flow
| Screen | File |
|---|---|
| Home | `app/(customer)/home.tsx` |
| Search | `app/(customer)/search.tsx` |
| Service Detail | `app/(customer)/service/[id].tsx` |
| Tasker Profile | `app/(customer)/tasker/[id].tsx` |
| Bookings | `app/(customer)/bookings.tsx` |
| Profile | `app/(customer)/profile.tsx` |
| Edit Profile | `app/(customer)/edit-profile.tsx` |
| Addresses | `app/(customer)/addresses.tsx` |
| Add Address | `app/(customer)/add-address.tsx` |

### Provider Flow
| Screen | File |
|---|---|
| Home | `app/(provider)/home.tsx` |
| Jobs | `app/(provider)/jobs.tsx` |
| Job Detail | `app/(provider)/job/[id].tsx` |
| Offer Detail | `app/(provider)/offer/[id].tsx` |
| Profile | `app/(provider)/profile.tsx` |
| Provider KYC | `app/(provider)/provider-kyc.tsx` |
| Provider KYC Status | `app/(provider)/provider-kyc-status.tsx` |

### Wallet Flow
| Screen | File |
|---|---|
| Wallet | `app/(wallet)/wallet.tsx` |
| Earnings | `app/(wallet)/earnings.tsx` |
| Transactions | `app/(wallet)/transactions.tsx` |
| Withdrawal | `app/(wallet)/withdrawal.tsx` |
| Withdrawal History | `app/(wallet)/withdrawal-history.tsx` |
| Company Earnings | `app/(wallet)/company-earnings.tsx` |
| Company Balance | `app/(wallet)/company-balance.tsx` |

### V2 Jobs Flow
| Screen | File |
|---|---|
| Jobs List | `app/(jobs)/jobs.tsx` |
| Provider List | `app/(jobs)/provider-list.tsx` |
| Job Confirmation | `app/(jobs)/job-confirmation.tsx` |
| Job Progress | `app/(jobs)/progress.tsx` |
| Reviews | `app/(jobs)/reviews.tsx` |
| Conversation | `app/(jobs)/conversation.tsx` |
| Customer Requests | `app/(jobs)/customer-requests.tsx` |

### Company Flow
| Screen | File |
|---|---|
| Profile | `app/(company)/profile.tsx` |
| Edit Profile | `app/(company)/edit-profile.tsx` |
| KYC | `app/(company)/kyc.tsx` |
| KYC Status | `app/(company)/kyc-status.tsx` |
| Team | `app/(company)/team.tsx` |
| Invites | `app/(company)/invites.tsx` |
| Invite Members | `app/(company)/invite-members.tsx` |
| Subscriptions | `app/(company)/subscriptions.tsx` |

### Other Screens
| Screen | File |
|---|---|
| Chat List | `app/(chat)/index.tsx` |
| Chat | `app/(chat)/[id].tsx` |
| Settings | `app/(settings)/index.tsx` |
| Email Settings | `app/(settings)/email.tsx` |
| Password | `app/(settings)/password.tsx` |
| Phone | `app/(settings)/phone.tsx` |
| Profile Photo | `app/(settings)/profile-photo.tsx` |
| Reviews | `app/(reviews)/reviews.tsx` |
| Add Review | `app/(reviews)/add.tsx` |
| Identity | `app/(identity)/index.tsx` |
| Identity Document | `app/(identity)/document.tsx` |
| Privacy | `app/(privacy)/index.tsx` |
| Data Requests | `app/(privacy)/data-requests.tsx` |
| Favorites | `app/(favorites)/index.tsx` |
| Properties | `app/(properties)/index.tsx` |
| Property Detail | `app/(properties)/[id].tsx` |
| Property Favorites | `app/(properties)/favorites.tsx` |
| Property Create | `app/(properties)/create.tsx` |
| Property Boost | `app/(properties)/boost/[id].tsx` |
| Property Inquiries | `app/(properties)/inquiries.tsx` |
| Notifications | `app/(notifications)/index.tsx` |
| Subscription Plans | `app/(subscription-plans)/index.tsx` |
| Admin Panel | `app/(admin)/panel.tsx` |
| Blocked Words | `app/(admin)/blocked-words.tsx` |

## Key Components

| Component | File | Purpose |
|---|---|---|
| AnimatedLogo | `components/ui/AnimatedLogo.tsx` | Gold gradient logo with particle effect |
| LoadingScreen | `components/ui/LoadingScreen.tsx` | Animated loading with logo |
| RippleButton | `components/ui/RippleButton.tsx` | Premium ripple press effect |
| GlassCard | `components/ui/GlassCard.tsx` | Frosted glass card |
| Shimmer | `components/ui/Shimmer.tsx` | Skeleton loading animation |
| GradientBadge | `components/ui/GradientBadge.tsx` | Status badges |
| SmartPullToRefresh | `components/ui/SmartPullToRefresh.tsx` | Pull-to-refresh |
| NetworkStatus | `components/ui/NetworkStatus.tsx` | Connection status |
| OtpInput | `components/auth/OtpInput.tsx` | 6-digit OTP input |
| LocationPicker | `components/ui/LocationPicker.tsx` | Location selection |
| DocumentPicker | `components/ui/DocumentPicker.tsx` | File upload |
| PaymentMethodPicker | `components/ui/PaymentMethodPicker.tsx` | Payment selection |
| QuoteCard | `components/quotes/QuoteCard.tsx` | Provider quote display |
| ProgressStepper | `components/progress/ProgressStepper.tsx` | Job progress steps |

## Design System

| Token | Value |
|---|---|
| Font | Outfit (Google Fonts) |
| Background | `#08080E` (near black) |
| Surface | `#12121A` |
| Card | `#1A1A25` |
| Border | `#252530` |
| Primary | `#F59E0B` (amber) |
| Success | `#10B981` (emerald) |
| Error | `#EF4444` (red) |
| Text Primary | `#FFFFFF` |
| Text Secondary | `#9CA3AF` |
| Text Muted | `#4B5563` |

## Platform-Specific Notes

### iOS
- Status bar: `light-content`
- Safe area insets applied to all layouts
- Haptic feedback on tab changes
- SF Symbols via `@expo/vector-icons/Ionicons`

### Android
- Status bar: `light-content` with transparent background
- Navigation bar: `#08080E`
- Material icons via `@expo/vector-icons/MaterialIcons`

## Known Issues

1. **Splash caching on iOS simulator** — Native splash binary cached, requires app reinstall
2. **No offline support** — All screens require network
3. **No push notification setup** — Notification model exists but no mobile integration
4. **No deep linking** — Expo universal links not configured
5. **No haptic feedback on critical actions** — Only tab changes have haptics
