import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../lib/colors'

export default function PaymentScreen() {
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  const methods = [
    { name: 'Visa', icon: 'card-outline' as const },
    { name: 'Mastercard', icon: 'card-outline' as const },
    { name: 'PayHere (Sri Lanka)', icon: 'wallet-outline' as const },
    { name: 'Stripe', icon: 'link-outline' as const },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>Payment Methods</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.infoCard}>
            <Ionicons name="wallet-outline" size={40} color={colors.gray} />
            <Text style={styles.infoTitle}>No payment methods</Text>
            <Text style={styles.infoSub}>
              You haven't added any payment methods yet. Add one to get started.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => Alert.alert('Coming Soon', 'Payment method integration is on its way!')}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.addBtnText}>  Add Payment Method</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Supported Methods</Text>
          <View style={styles.card}>
            {methods.map((m, i) => (
              <View key={m.name} style={[styles.row, i === methods.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons name={m.icon} size={20} color={colors.customerAccent} />
                <Text style={styles.methodName}>{m.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark, paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  infoCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: 32,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  infoTitle: { fontSize: 17, fontWeight: '700', color: colors.dark, marginTop: 12 },
  infoSub: { fontSize: 13, color: colors.gray, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.customerAccent, paddingVertical: 14, borderRadius: 14, marginBottom: 24,
  },
  addBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.gray, marginBottom: 10, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.white, borderRadius: 14, padding: 4, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  methodName: { fontSize: 15, fontWeight: '600', color: colors.dark },
})
