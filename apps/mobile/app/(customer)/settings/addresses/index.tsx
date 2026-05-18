import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../lib/colors'

export default function AddressesScreen() {
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>Saved Addresses</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={48} color={colors.gray} />
            <Text style={styles.emptyTitle}>No addresses saved</Text>
            <Text style={styles.emptySub}>
              Add your home, work, or other frequent locations for faster booking.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => Alert.alert('Coming Soon', 'Address management is on its way!')}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.addBtnText}>  Add Address</Text>
          </TouchableOpacity>

          <View style={styles.demoCard}>
            <View style={styles.demoHeader}>
              <Ionicons name="home" size={20} color={colors.customerAccent} />
              <Text style={styles.demoLabel}>  Home</Text>
            </View>
            <Text style={styles.demoAddress}>123 Galle Road, Colombo 03</Text>
            <Text style={styles.demoSub}>Western Province, 00100, Sri Lanka</Text>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>Default</Text>
            </View>
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
  emptyCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: 32,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.dark, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.gray, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.customerAccent, paddingVertical: 14, borderRadius: 14, marginBottom: 24,
  },
  addBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  demoCard: {
    backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  demoLabel: { fontSize: 15, fontWeight: '700', color: colors.dark },
  demoAddress: { fontSize: 14, color: colors.darkMid, marginBottom: 2 },
  demoSub: { fontSize: 13, color: colors.gray, marginBottom: 10 },
  demoBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.customerAccent,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  demoBadgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
})
