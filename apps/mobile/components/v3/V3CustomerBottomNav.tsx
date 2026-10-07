import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { House, MagnifyingGlass, Plus, ClockCounterClockwise, User } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
}

const tabs: TabItem[] = [
  { key: 'home', icon: House, label: 'Home' },
  { key: 'explore', icon: MagnifyingGlass, label: 'Explore' },
  { key: 'activity', icon: ClockCounterClockwise, label: 'Activity' },
  { key: 'account', icon: User, label: 'Account' },
]

export default function V3CustomerBottomNav({ activeTab, onTabPress, onPostJob }: Props) {
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 6)

  const renderTab = (tab: TabItem) => {
    const focused = activeTab === tab.key
    const Icon = tab.icon
    return (
      <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onTabPress(tab.key)} activeOpacity={0.72}>
        <Icon size={20} color={focused ? v3.colors.ink : '#8A8A8A'} weight={focused ? 'bold' : 'regular'} />
        <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      {tabs.slice(0, 2).map(renderTab)}

      <TouchableOpacity style={styles.postTab} onPress={onPostJob} activeOpacity={0.82}>
        <View style={styles.fab}>
          <Plus size={22} color={v3.colors.paper} weight="bold" />
        </View>
        <Text style={styles.label}>Post</Text>
      </TouchableOpacity>

      {tabs.slice(2).map(renderTab)}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: v3.colors.paper,
    borderTopWidth: 1,
    borderTopColor: v3.colors.line,
    paddingTop: 10,
    paddingHorizontal: 3,
    ...Platform.select({
      ios: { position: 'absolute', bottom: 0, left: 0, right: 0 },
      default: { elevation: 8 },
    }),
  },
  tab: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 7,
  },
  postTab: {
    flex: 1,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    color: '#8A8A8A',
  },
  labelActive: {
    color: v3.colors.ink,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -17,
    marginBottom: 5,
  },
})
