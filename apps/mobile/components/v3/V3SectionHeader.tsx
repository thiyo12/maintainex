import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CaretRight } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  title: string
  subtitle?: string
  actionText?: string
  onAction?: () => void
  tag?: string
  tagColor?: string
}

export default function V3SectionHeader({ title, subtitle, actionText, onAction, tag, tagColor }: Props) {
  return (
    <View style={styles.container}>
      {tag ? (
        <Text style={[styles.tag, { color: tagColor || v3.colors.amber }]}>{tag}</Text>
      ) : null}
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actionText && onAction ? (
          <TouchableOpacity onPress={onAction} activeOpacity={0.7} style={styles.actionRow}>
            <Text style={styles.actionText}>{actionText}</Text>
            <CaretRight size={11} color={v3.colors.textSecondary} weight="bold" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    marginBottom: 14,
    paddingHorizontal: 18,
  },
  tag: {
    fontSize: 8.4,
    fontFamily: 'Outfit_900Black',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.textPrimary,
  },
  subtitle: {
    fontSize: 10.2,
    fontFamily: 'Outfit_500Medium',
    color: v3.colors.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    fontSize: 9.8,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textSecondary,
  },
})
