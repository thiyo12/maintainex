import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import PressScale from './PressScale'
import { colors } from '../../lib/colors'

interface Props {
  name: string
  iconName: keyof typeof Ionicons.glyphMap
  colorHex: string
  jobCount: number
  onPress: () => void
}

export default function CategoryCard({ name, iconName, colorHex, jobCount, onPress }: Props) {
  return (
    <PressScale onPress={onPress}>
      <View style={[styles.card, { borderLeftColor: colorHex }]}>
        <View style={[styles.iconWrap, { backgroundColor: colorHex + '20' }]}>
          <Ionicons name={iconName as any} size={24} color={colorHex} />
        </View>
        <View style={styles.content}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.count}>{jobCount} jobs available</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </View>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  count: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
})
