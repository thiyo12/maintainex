import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, Switch, StyleSheet, Animated, ActivityIndicator } from 'react-native'
import { Tag, Lightning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { offerProgram } from '../../lib/api-v2'

interface Props {
  variant: 'tasker' | 'company'
  taskerId?: string
  companyId?: string
}

export default function OfferProgramSection({ variant, taskerId, companyId }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const [enrolled, setEnrolled] = useState(false)
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    loadOffers()
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start()
  }, [])

  const loadOffers = async () => {
    try {
      const res = await offerProgram.listTemplates()
      setOffers(res.offers || [])
    } catch {
      setOffers([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      if (enrolled) {
        await offerProgram.unenroll(variant)
        setEnrolled(false)
      } else {
        const id = variant === 'tasker' ? taskerId : companyId
        if (id) await offerProgram.enroll(variant, id)
        setEnrolled(true)
      }
    } catch {
      setEnrolled(!enrolled)
    } finally {
      setToggling(false)
    }
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Tag size={14} color={colors.amberDark} />
          <Text style={[styles.title, { color: colors.ink }]}>{t('components.viewOffer')}</Text>
        </View>
        {toggling ? (
          <ActivityIndicator size="small" color={colors.amber} />
        ) : (
          <Switch
            value={enrolled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: colors.amberLight }}
            thumbColor={enrolled ? colors.amber : colors.muted}
          />
        )}
      </View>
      <Text style={[styles.description, { color: colors.muted }]}>
        {enrolled
          ? t('components.enrolledDesc')
          : t('components.joinDesc')}
      </Text>
      {offers.length > 0 && enrolled && (
        <View style={styles.offersList}>
          {offers.map((offer: any) => (
            <View key={offer.id} style={[styles.offerItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Lightning size={14} color={colors.amberDark} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.offerName, { color: colors.ink }]}>{offer.title}</Text>
                {offer.description ? (
                  <Text style={[styles.offerDesc, { color: colors.muted }]}>{offer.description}</Text>
                ) : null}
              </View>
              <Text style={[styles.offerDiscount, { color: colors.amberDark }]}>
                {offer.discountType === 'PERCENTAGE' ? `${offer.discountValue}%` : `LKR ${offer.discountValue}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: colors.white,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
  },
  description: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 16,
  },
  offersList: {
    marginTop: 12,
    gap: 8,
  },
  offerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  offerName: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  offerDesc: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    marginTop: 1,
  },
  offerDiscount: {
    fontSize: 13,
    fontFamily: 'Outfit_900Black',
  },
})
