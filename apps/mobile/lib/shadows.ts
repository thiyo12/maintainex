import { Platform } from 'react-native'

export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16 },
    android: { elevation: 4 },
  }),
  subtle: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
    android: { elevation: 2 },
  }),
  amberGlow: Platform.select({
    ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
    android: { elevation: 6 },
  }),
  successGlow: Platform.select({
    ios: { shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16 },
    android: { elevation: 6 },
  }),
  navBar: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 12 },
    android: { elevation: 8 },
  }),
}
