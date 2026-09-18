import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Copy, House, Sparkle, Ticket } from 'phosphor-react-native'
import * as Clipboard from 'expo-clipboard'
import { v3 } from '../../../theme/v3/tokens'
import V3PageHeader from '../../../components/v3/V3PageHeader'

const VOUCHERS = [
  { code: 'MXWELCOME', title: 'LKR 500 off', meta: 'Eligible first service bookings', icon: Sparkle },
  { code: 'CLEAN20', title: '20% off cleaning', meta: 'Selected cleaning services', icon: Ticket },
  { code: 'STAY10', title: '10% off selected stays', meta: 'Eligible daily stays', icon: House },
]

export default function VouchersScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <V3PageHeader title="Vouchers" subtitle="Apply eligible discounts before securing payment." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>YOUR OFFERS</Text>
        {VOUCHERS.map(({ code, title, meta, icon: Icon }) => (
          <View key={code} style={styles.card}>
            <View style={styles.icon}><Icon size={20} color={v3.colors.ink} weight="fill" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.code}>{code}</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.meta}>{meta}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.75} onPress={() => Clipboard.setStringAsync(code)} style={styles.copy}>
              <Copy size={17} color={v3.colors.ink} weight="bold" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  section: { marginBottom: 8, fontFamily: 'Outfit_800ExtraBold', fontSize: 10, color: v3.colors.textMuted, letterSpacing: 0.8 },
  card: { minHeight: 94, marginBottom: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: v3.colors.line, backgroundColor: v3.colors.paper, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: v3.colors.amberSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  code: { fontFamily: 'Outfit_800ExtraBold', fontSize: 11, color: v3.colors.amberDark, letterSpacing: 0.8 },
  title: { marginTop: 2, fontFamily: 'Outfit_800ExtraBold', fontSize: 15, color: v3.colors.ink },
  meta: { marginTop: 2, fontFamily: 'Outfit_400Regular', fontSize: 11.5, color: v3.colors.textSecondary },
  copy: { width: 38, height: 38, borderRadius: 12, backgroundColor: v3.colors.canvas, alignItems: 'center', justifyContent: 'center' },
})
