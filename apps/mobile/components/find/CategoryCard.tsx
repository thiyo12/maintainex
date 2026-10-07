import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { CaretRight, Wrench } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import { getCategoryI18nKey } from '@/lib/categories'

interface Props {
  id?: string
  name: string
  iconName?: string
  colorHex: string
  jobCount: number
  onPress: () => void
}

export default function CategoryCard({ id, name, iconName, colorHex, jobCount, onPress }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: colorHex }]}>
        <View style={[styles.iconWrap, { backgroundColor: colorHex + '20' }]}>
          <Wrench size={22} color={colorHex} weight="fill" />
        </View>
        <View style={styles.content}>
          <Text style={[styles.name, { color: colors.ink }]}>{t(getCategoryI18nKey({ id: id || name }))}</Text>
          <Text style={[styles.count, { color: colors.muted }]}>{t('components.jobsAvailable', { n: jobCount })}</Text>
        </View>
        <CaretRight size={16} color={colors.muted} weight="bold" />
      </View>
    </TouchableOpacity>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  count: { fontSize: 12, color: '#B3B3B3', marginTop: 2 },
})
