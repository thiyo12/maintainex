import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CreditCard, Wallet, Link, PlusCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../../lib/ThemeContext'
import { fonts } from '../../../../lib/fonts'

export default function PaymentScreen() {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  const methods = [
    { name: t('payment.methodVisa'), icon: CreditCard },
    { name: t('payment.methodMastercard'), icon: CreditCard },
    { name: t('payment.methodPayHere'), icon: Wallet },
    { name: t('payment.methodStripe'), icon: Link },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <Text style={styles.heading}>{t('profile.payment')}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <View style={styles.infoCard}>
            <Wallet size={40} color={'#6F6B6B'} weight="bold" />
            <Text style={styles.infoTitle}>{t('profile.noPaymentMethods')}</Text>
            <Text style={styles.infoSub}>
              {t('profile.addPaymentMethod')}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => Alert.alert(t('payment.comingSoon'), t('payment.comingSoonDesc'))}
          >
            <PlusCircle size={20} color={'#FFFFFF'} weight="bold" />
            <Text style={styles.addBtnText}>  {t('common.add')}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{t('profile.payment')}</Text>
          <View style={styles.card}>
            {methods.map((m, i) => {
              const MethodIcon = m.icon
              return (
                <View key={m.name} style={[styles.row, i === methods.length - 1 && { borderBottomWidth: 0 }]}>
                  <MethodIcon size={20} color={'#F5A623'} weight="bold" />
                  <Text style={styles.methodName}>{m.name}</Text>
                </View>
              )
            })}
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
  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 32,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  infoTitle: { fontSize: 17, fontFamily: fonts.headingBold, color: '#FFFFFF', marginTop: 12 },
  infoSub: { fontSize: 13, color: '#6F6B6B', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  addBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F5A623', paddingVertical: 14, borderRadius: 14, marginBottom: 24,
  },
  addBtnText: { fontSize: 16, fontFamily: fonts.headingBold, color: '#FFFFFF' },
  sectionTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: '#6F6B6B', marginBottom: 10, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 4, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#2E2E2E',
  },
  methodName: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: '#FFFFFF' },
})
