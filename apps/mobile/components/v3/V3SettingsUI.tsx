import { ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretRight } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

export function V3SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

export function V3SettingsCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>
}

type RowProps = {
  icon?: any
  title: string
  subtitle?: string
  value?: string
  onPress?: () => void
  trailing?: ReactNode
  danger?: boolean
  last?: boolean
}

export function V3SettingsRow({ icon: Icon, title, subtitle, value, onPress, trailing, danger, last }: RowProps) {
  const body = (
    <View style={[styles.row, last && styles.lastRow]}>
      {Icon ? (
        <View style={[styles.iconBox, danger && styles.dangerIcon]}>
          <Icon size={19} color={danger ? v3.colors.error : v3.colors.ink} weight="fill" />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, danger && { color: v3.colors.error }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {trailing ?? (onPress ? <CaretRight size={17} color={v3.colors.textMuted} weight="bold" /> : null)}
    </View>
  )
  if (!onPress) return body
  return <TouchableOpacity onPress={onPress} activeOpacity={0.72}>{body}</TouchableOpacity>
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2,
  },
  card: {
    backgroundColor: v3.colors.paper, borderRadius: 20, borderWidth: 1,
    borderColor: v3.colors.line, overflow: 'hidden',
  },
  row: {
    minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: v3.colors.line,
  },
  lastRow: { borderBottomWidth: 0 },
  iconBox: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: v3.colors.canvas,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  dangerIcon: { backgroundColor: v3.colors.errorSoft },
  copy: { flex: 1 },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: v3.colors.ink },
  subtitle: { fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 16, color: v3.colors.textSecondary, marginTop: 2 },
  value: { fontFamily: 'Outfit_700Bold', fontSize: 11.5, color: v3.colors.textSecondary, marginRight: 8 },
})
