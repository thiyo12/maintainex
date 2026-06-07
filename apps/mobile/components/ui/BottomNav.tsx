import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
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

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border, ...shadows.lg }]}>
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.iconName as any : (`${tab.iconName}-outline`) as any}
              size={24}
              color={isActive ? colors.primary : colors.muted}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.primary : colors.muted },
                isActive && { fontFamily: fonts.label },
              ]}
            >
              {tab.label}
            </Text>
            {isActive ? <View style={[styles.indicator, { backgroundColor: colors.primary }]} /> : null}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    position: 'relative',
  },
  label: {
    fontSize: fontSizes.label,
    fontFamily: fonts.body,
    marginTop: 4,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
})
