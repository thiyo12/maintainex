import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/colors'
import PressScale from '@/components/ui/PressScale'
import { useTranslation } from 'react-i18next'

export default function RoleSelectScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)

  const roles = [
    {
      id: 'CUSTOMER',
      icon: 'hand-left-outline' as const,
      title: t('auth.roleSelect.iNeedWork'),
      subtitle: t('auth.roleSelect.iNeedWorkDesc'),
      color: colors.customerAccent,
    },
    {
      id: 'TASKER',
      icon: 'construct-outline' as const,
      title: t('auth.roleSelect.iAmTasker'),
      subtitle: t('auth.roleSelect.iAmTaskerDesc'),
      color: colors.taskerAccent,
    },
    {
      id: 'COMPANY',
      icon: 'business-outline' as const,
      title: t('auth.roleSelect.weAreCompany'),
      subtitle: t('auth.roleSelect.weAreCompanyDesc'),
      color: colors.companyAccent,
    },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>{t('auth.roleSelect.back')}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>{t('auth.roleSelect.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.roleSelect.subtitle')}</Text>

        <View style={styles.cardList}>
          {roles.map((role) => {
            const isSelected = selected === role.id
            return (
              <PressScale key={role.id} onPress={() => setSelected(role.id)}>
                <View style={[
                  styles.card,
                  isSelected && { borderColor: role.color, borderWidth: 2 },
                ]}>
                  <View style={styles.cardContent}>
                    <View style={styles.cardLeft}>
                      <Ionicons name={role.icon} size={32} color={role.color} style={{ marginRight: 16 }} />
                      <View style={styles.cardText}>
                        <Text style={styles.cardTitle}>{role.title}</Text>
                        <Text style={styles.cardSubtitle}>{role.subtitle}</Text>
                      </View>
                    </View>
                    <Text style={[styles.arrow, isSelected && { color: role.color }]}>
                      ›
                    </Text>
                  </View>
                </View>
              </PressScale>
            )
          })}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !selected && styles.continueButtonDisabled]}
          onPress={() => {
            if (selected) {
              router.push({ pathname: '/(auth)/register', params: { role: selected } })
            }
          }}
          disabled={!selected}
          activeOpacity={0.8}
        >
          <Text style={[styles.continueText, !selected && styles.continueTextDisabled]}>
            {t('auth.roleSelect.continue')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 32,
  },
  cardList: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.lightGray,
    padding: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.gray,
  },
  arrow: {
    fontSize: 24,
    color: colors.gray,
    fontWeight: '300',
    marginLeft: 12,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 40,
  },
  continueButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  continueTextDisabled: {
    color: colors.gray,
  },
})
