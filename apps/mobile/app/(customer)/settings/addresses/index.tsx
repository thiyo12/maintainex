import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import { Buildings, House, MapPin, Plus } from 'phosphor-react-native'
import { v3 } from '../../../../theme/v3/tokens'
import V3PageHeader from '../../../../components/v3/V3PageHeader'
import { V3SectionLabel, V3SettingsCard, V3SettingsRow } from '../../../../components/v3/V3SettingsUI'
import { useAuth } from '../../../../lib/auth'

const KEY = 'customer_saved_addresses_v3'

export default function AddressesScreen() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((raw) => {
      if (raw) return setItems(JSON.parse(raw))
      const fallback = [(user as any)?.area, (user as any)?.city].filter(Boolean).join(', ')
      if (fallback) setItems([{ id: 'home', label: 'Home', address: fallback }])
    }).catch(() => {})
  }, [user])

  const add = () => {
    Alert.prompt?.('Add address', 'Enter an area, street or landmark', async (address) => {
      if (!address?.trim()) return
      const next = [...items, { id: String(Date.now()), label: items.length ? 'Saved place' : 'Home', address: address.trim() }]
      setItems(next)
      await SecureStore.setItemAsync(KEY, JSON.stringify(next))
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Addresses" subtitle="Saved locations make posting a job almost instant." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <V3SectionLabel>Your places</V3SectionLabel>
        {items.length ? (
          <V3SettingsCard>
            {items.map((item, index) => (
              <V3SettingsRow
                key={item.id}
                icon={index === 0 ? House : index === 1 ? Buildings : MapPin}
                title={item.label}
                subtitle={item.address}
                onPress={() => Alert.alert(item.label, item.address)}
                last={index === items.length - 1}
              />
            ))}
          </V3SettingsCard>
        ) : (
          <View style={styles.empty}>
            <MapPin size={34} color={v3.colors.ink} weight="fill" />
            <Text style={styles.emptyTitle}>No saved places yet</Text>
            <Text style={styles.emptyText}>Save home, office or family addresses so future jobs take fewer taps.</Text>
          </View>
        )}

        <TouchableOpacity activeOpacity={0.8} onPress={add} style={styles.primary}>
          <Plus size={18} color={v3.colors.paper} weight="bold" />
          <Text style={styles.primaryText}>Add new address</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  empty: { padding: 28, borderRadius: 20, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: v3.colors.ink },
  emptyText: { marginTop: 4, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, color: v3.colors.textSecondary, textAlign: 'center' },
  primary: { marginTop: 16, height: 54, borderRadius: 16, backgroundColor: v3.colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: v3.colors.paper },
})
