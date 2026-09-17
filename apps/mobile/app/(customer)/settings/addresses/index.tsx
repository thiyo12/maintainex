import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MapPin, PlusCircle, House, Buildings } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'

export default function AddressesScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('profile.savedAddresses')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.emptyCard}>
            <MapPin size={48} color={'#6F6B6B'} weight="bold" />
            <Text style={styles.emptyTitle}>{t('profile.noAddresses')}</Text>
            <Text style={styles.emptySub}>
              {t('profile.addAddress')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => Alert.alert(t('addresses.comingSoon'), t('addresses.comingSoonDesc'))}
          >
            <PlusCircle size={20} color={'#FFFFFF'} weight="bold" />
            <Text style={styles.addBtnText}>  {t('profile.addAddress')}</Text>
          </TouchableOpacity>

          <View style={styles.demoCard}>
            <View style={styles.demoHeader}>
              <House size={20} color={'#F5A623'} weight="bold" />
              <Text style={styles.demoLabel}>  {t('addresses.home')}</Text>
            </View>
            <Text style={styles.demoAddress}>123 Galle Road, Colombo 03</Text>
            <Text style={styles.demoSub}>Western Province, 00100, Sri Lanka</Text>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>{t('addresses.default')}</Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  heading: { fontSize: 28, fontFamily: fonts.heading, color: '#FFFFFF', paddingHorizontal: 24, marginBottom: 16 },
  scroll: { paddingHorizontal: 24 },
  emptyCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 32,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  emptyTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: '#FFFFFF', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#6F6B6B', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F5A623', paddingVertical: 14, borderRadius: 14, marginBottom: 24,
  },
  addBtnText: { fontSize: 16, fontFamily: fonts.headingBold, color: '#FFFFFF' },
  demoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  demoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  demoLabel: { fontSize: 15, fontFamily: fonts.headingBold, color: '#FFFFFF' },
  demoAddress: { fontSize: 14, color: '#2E2E2E', marginBottom: 2 },
  demoSub: { fontSize: 13, color: '#6F6B6B', marginBottom: 10 },
  demoBadge: {
    alignSelf: 'flex-start', backgroundColor: '#F5A623',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  demoBadgeText: { fontSize: 11, fontFamily: fonts.headingBold, color: '#FFFFFF' },
})
