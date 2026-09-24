import { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Dimensions, ScrollView } from 'react-native'
import { Sun, Snowflake, Flower, Leaf, CloudRain, CloudSun } from 'phosphor-react-native'
import { useColors } from '../../lib/ThemeContext'
import { useCountry } from '../../lib/country'
import { serviceCategories } from '../../lib/api'
import {
  getCurrentSeason, getSeasonColors,
  getSeasonalServiceNames, getSeasonalTitle, getSeasonBadge,
} from '../../lib/seasonal'
import { fonts } from '../../lib/fonts'

interface Props {
  onServicePress?: (jobId: string, jobName: string) => void
}

interface ServiceItem {
  id: string
  name: string
}

const SCREEN_WIDTH = Dimensions.get('window').width

export default function SeasonalOffers({ onServicePress }: Props) {
  const colors = useColors()
  const { selectedCountry } = useCountry()
  const styles = makeStyles(colors)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [showSheet, setShowSheet] = useState(false)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current

  const countryCode = selectedCountry?.code || 'LK'
  const season = getCurrentSeason(countryCode)
  const seasonColors = getSeasonColors(season)
  const serviceNames = getSeasonalServiceNames(countryCode, season)

  useEffect(() => {
    if (serviceNames.length === 0) return
    serviceCategories.list(countryCode).then((categories) => {
      const matched: ServiceItem[] = []
      const nameSet = new Set(serviceNames.map((s) => s.toLowerCase()))
      for (const cat of categories) {
        for (const job of cat.jobs) {
          if (nameSet.has(job.name.toLowerCase())) {
            matched.push({ id: job.id, name: job.name })
          }
        }
      }
      setServices(matched)
    }).catch(() => {})
  }, [countryCode, season])

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    blink.start()
    return () => blink.stop()
  }, [])

  const openSheet = () => {
    setShowSheet(true)
    Animated.spring(slideAnim, {
      toValue: 0, friction: 8, tension: 60, useNativeDriver: true,
    }).start()
  }

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true,
    }).start(() => setShowSheet(false))
  }

  return (
    <>
      {/* ─── Blinking Season Tab ─── */}
      <Animated.View style={{ opacity: pulseAnim }}>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: seasonColors.bg }]}
          onPress={openSheet}
          activeOpacity={0.8}
        >
          <SeasonIcon season={season} size={18} color={seasonColors.text} />
          <Text style={[styles.tabLabel, { color: seasonColors.text }]}>
            {season.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Seasonal Services Sheet ─── */}
      <Modal visible={showSheet} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeSheet}>
          <Animated.View style={[styles.sheet, { transform: [{ translateX: slideAnim }] }]}>
            <TouchableOpacity activeOpacity={1}>
              <View style={[styles.sheetHeaderWrap, { backgroundColor: seasonColors.bg }]}>
                <View style={styles.sheetHeaderRow}>
                  <SeasonIcon season={season} size={32} color={seasonColors.text} />
                  <View style={styles.sheetHeaderText}>
                    <Text style={[styles.sheetBadge, { color: seasonColors.text }]}>{getSeasonBadge(season)}</Text>
                    <Text style={[styles.sheetTitle, { color: seasonColors.text }]}>{getSeasonalTitle(countryCode, season)}</Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={closeSheet}>
                    <Text style={[styles.closeBtnText, { color: seasonColors.text }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
                {services.map((svc) => (
                  <TouchableOpacity
                    key={svc.id}
                    style={[styles.serviceItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      closeSheet()
                      onServicePress?.(svc.id, svc.name)
                    }}
                  >
                    <View style={[styles.serviceDot, { backgroundColor: seasonColors.bg }]} />
                    <Text style={[styles.serviceName, { color: colors.ink }]}>{svc.name}</Text>
                    <Text style={[styles.serviceArrow, { color: colors.muted }]}>→</Text>
                  </TouchableOpacity>
                ))}
                {services.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.muted }]}>No seasonal services available</Text>
                )}
              </ScrollView>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

function SeasonIcon({ season, size, color }: { season: string; size: number; color: string }) {
  const icons: Record<string, React.ReactNode> = {
    summer: <Sun size={size} color={color} weight="fill" />,
    winter: <Snowflake size={size} color={color} weight="bold" />,
    spring: <Flower size={size} color={color} weight="fill" />,
    fall: <Leaf size={size} color={color} weight="bold" />,
    southwest_monsoon: <CloudRain size={size} color={color} weight="fill" />,
    second_intermonsoon: <CloudRain size={size} color={color} weight="fill" />,
    northeast_monsoon: <CloudRain size={size} color={color} weight="fill" />,
    first_intermonsoon: <CloudSun size={size} color={color} weight="fill" />,
  }
  return <>{icons[season] || <Sun size={size} color={color} weight="fill" />}</>
}

const makeStyles = (colors: any) => StyleSheet.create({
  tab: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 100, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  tabLabel: { fontSize: 13, fontFamily: fonts?.bodyMedium || 'Inter_500Medium' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: Dimensions.get('window').height * 0.65,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 12,
  },
  sheetHeaderWrap: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 16,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },


  sheetHeaderText: { flex: 1 },
  sheetBadge: { fontSize: 10, fontFamily: fonts?.bodyMedium || 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.7 },
  sheetTitle: { fontSize: 20, fontFamily: fonts?.heading || 'Inter_600SemiBold', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontFamily: fonts?.bodyMedium || 'Inter_500Medium', opacity: 0.8 },
  sheetScroll: { maxHeight: Dimensions.get('window').height * 0.45 },
  sheetScrollContent: { paddingBottom: 32 },
  serviceItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 0.5, gap: 12,
  },
  serviceDot: { width: 8, height: 8, borderRadius: 4 },
  serviceName: { flex: 1, fontSize: 15, fontFamily: fonts?.body || 'Inter_400Regular' },
  serviceArrow: { fontSize: 16, fontFamily: fonts?.body || 'Inter_400Regular' },
  emptyText: { textAlign: 'center', paddingVertical: 40, fontSize: 14, fontFamily: fonts?.body || 'Inter_400Regular' },
})
