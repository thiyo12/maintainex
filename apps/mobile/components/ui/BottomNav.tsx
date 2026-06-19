import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'
import { spacing, borderRadius, shadows } from '../../lib/tokens'

interface Tab {
  key: string
  label: string
  iconName: string
}

interface Props {
  tabs: Tab[]
  active: string
  onSelect: (key: string) => void
}

export default function BottomNav({ tabs, active, onSelect }: Props) {
  const colors = useColors()
    const styles = makeStyles(colors)

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }, shadows.lg]}>
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && { backgroundColor: colors.primaryBg }]}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.iconName as any : (`${tab.iconName}-outline`) as any}
              size={22}
              color={isActive ? colors.primaryDark : colors.muted}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.primaryDark : colors.muted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: spacing.sm + 2,
    marginHorizontal: spacing.sm,
    borderRadius: 20,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 0,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: 3,
  },
  label: {
    fontSize: 9,
    fontFamily: fonts.label,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
})
