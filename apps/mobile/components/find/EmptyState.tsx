import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface Props {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
}

export default function EmptyState({ icon = 'search-outline', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color="#D1D5DB" />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  title: { fontSize: 16, fontWeight: '600', color: '#9CA3AF', marginTop: 12, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#D1D5DB', marginTop: 4, textAlign: 'center' },
})
