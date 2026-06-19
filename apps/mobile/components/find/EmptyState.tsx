import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fonts } from '../../lib/fonts'

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
  title: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#6B7280', marginTop: 12, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
})
