import { useEffect, useState } from 'react'
import { Tabs } from 'expo-router'
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { House, SquaresFour, Plus, Wallet, User } from 'phosphor-react-native'
import { taskers } from '../../../lib/api'
import { emit, on } from '../../../lib/events'
import { fonts } from '../../../lib/fonts'
import { v3 } from '../../../theme/v3/tokens'

const routedItems = [
  { route: 'index', label: 'Home', Icon: House },
  { route: 'my-jobs', label: 'Jobs', Icon: SquaresFour },
  { route: 'earnings', label: 'Earnings', Icon: Wallet },
  { route: 'profile', label: 'Profile', Icon: User },
] as const

function TaskerTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets()
  const current = state.routes[state.index]?.name
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    let mounted = true
    taskers.getMyProfile()
      .then((profile: any) => {
        if (mounted && typeof profile?.isOnline === 'boolean') setIsOnline(profile.isOnline)
      })
      .catch(() => {})

    const off = on('taskerOnlineChanged', (next: boolean) => setIsOnline(Boolean(next)))
    return () => {
      mounted = false
      off()
    }
  }, [])

  const go = (route: string) => {
    if (current === route) return
    navigation.navigate(route)
  }

  const iconColor = (route: string) => current === route ? v3.colors.ink : v3.colors.textMuted

  return (
    <View style={[styles.bar, { height: 78 + insets.bottom, paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.item} activeOpacity={0.72} onPress={() => go('index')}>
        <House size={18} color={iconColor('index')} weight={current === 'index' ? 'bold' : 'regular'} />
        <Text style={[styles.label, current === 'index' && styles.labelActive]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.72} onPress={() => go('my-jobs')}>
        <SquaresFour size={18} color={iconColor('my-jobs')} weight={current === 'my-jobs' ? 'bold' : 'regular'} />
        <Text style={[styles.label, current === 'my-jobs' && styles.labelActive]}>Jobs</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.76}
        onPress={() => {
          if (current !== 'index') navigation.navigate('index')
          else emit('taskerGoPressed')
        }}
      >
        <View style={[styles.goCircle, { backgroundColor: isOnline ? v3.colors.ink : v3.colors.success }]}>
          <Plus size={18} color={v3.colors.paper} weight="bold" />
        </View>
        <Text style={styles.label}>Go</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.72} onPress={() => go('earnings')}>
        <Wallet size={18} color={iconColor('earnings')} weight={current === 'earnings' ? 'bold' : 'regular'} />
        <Text style={[styles.label, current === 'earnings' && styles.labelActive]}>Earnings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} activeOpacity={0.72} onPress={() => go('profile')}>
        <User size={18} color={iconColor('profile')} weight={current === 'profile' ? 'bold' : 'regular'} />
        <Text style={[styles.label, current === 'profile' && styles.labelActive]}>Profile</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function TaskerTabs() {
  return (
    <Tabs
      tabBar={(props) => <TaskerTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {routedItems.map(({ route, label }) => (
        <Tabs.Screen key={route} name={route} options={{ title: label }} />
      ))}
    </Tabs>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: v3.colors.paper,
    borderTopWidth: 1,
    borderTopColor: v3.colors.line,
    paddingTop: 11,
  },
  item: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 7,
  },
  goCircle: {
    width: 50,
    height: 50,
    marginTop: -9,
    marginBottom: -2,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    lineHeight: 11,
    fontFamily: fonts.bodySemiBold,
    color: v3.colors.textMuted,
  },
  labelActive: {
    color: v3.colors.ink,
  },
})
