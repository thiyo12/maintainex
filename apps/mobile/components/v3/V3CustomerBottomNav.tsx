import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { House, Compass, Plus, ClockCounterClockwise, User } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { v3 } from '../../theme/v3/tokens'

interface TabItem {
  key: string
  icon: typeof House
  label: string
}

interface Props {
  activeTab: string
  onTabPress: (tab: string) => void
  onPostJob: () => void
  unreadCount?: number
}

const tabs: TabItem[] = [
  { key: 'home', icon: House, label: 'Home' },
  { key: 'explore', icon: Compass, label: 'Explore' },
  { key: 'activity', icon: ClockCounterClockwise, label: 'Activity' },
  { key: 'account', icon: User, label: 'Account' },
]

export default function V3CustomerBottomNav({ activeTab, onTabPress, onPostJob, unreadCount = 0 }: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const bottomPad = Math.max(insets.bottom, 4)

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      {tabs.slice(0, 2).map((tab) => {
        const focused = activeTab === tab.key
        const Icon = tab.icon
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onTabPress(tab.key)} activeOpacity={0.7}>
            <Icon size={22} color={focused ? v3.colors.ink : v3.colors.textMuted} weight={focused ? 'fill' : 'regular'} />
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}

      <TouchableOpacity style={styles.fab} onPress={onPostJob} activeOpacity={0.8}>
        <Plus size={24} color={v3.colors.paper} weight="bold" />
      </TouchableOpacity>

      {tabs.slice(2).map((tab) => {
        const focused = activeTab === tab.key
        const Icon = tab.icon
        const showBadge = tab.key === 'activity' && unreadCount > 0
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onTabPress(tab.key)} activeOpacity={0.7}>
            <View>
              <Icon size={22} color={focused ? v3.colors.ink : v3.colors.textMuted} weight={focused ? 'fill' : 'regular'} />
              {showBadge ? <View style={styles.badge} /> : null}
            </View>
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: v3.colors.paper,
    borderTopWidth: 1,
    borderTopColor: v3.colors.line,
    paddingTop: 8,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
      default: { elevation: 8 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textMuted,
  },
  labelActive: {
    color: v3.colors.ink,
    fontFamily: 'Outfit_700Bold',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      default: { elevation: 6 },
    }),
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: v3.colors.error,
  },
})
