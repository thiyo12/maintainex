import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Dimensions, ScrollView } from 'react-native'
import { Wrench, Sparkle, Thermometer, Leaf, Truck, ShieldCheck, Car, Monitor, Lightning, Drop, Palette, Bug, Toolbox, Sun, Basketball, Heart } from 'phosphor-react-native'
import { useTheme } from '@/lib/ThemeContext'
import { useCountry } from '@/lib/country'
import { serviceCategories } from '@/lib/api'
import { fonts } from '@/lib/fonts'

const DUPLICATE_CATEGORIES = new Set(['home repairs', 'cleaning', 'hvac', 'gardening', 'moving & delivery', 'security', 'automotive', 'it services'])

interface CategoryJob {
  id: string
  name: string
}

interface CategoryWithJobs {
  id: string
  name: string
  jobs: CategoryJob[]
}

interface Props {
  onCategoryPress?: (categoryId: string, categoryName: string) => void
  onServicePress?: (jobId: string, jobName: string) => void
}

const SCREEN_HEIGHT = Dimensions.get('window').height

export default function CategoryGrid({ onCategoryPress, onServicePress }: Props) {
  const { colors, isDark } = useTheme()
  const { selectedCountry } = useCountry()
  const styles = makeStyles(colors)
  const [categories, setCategories] = useState<CategoryWithJobs[]>([])
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithJobs | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  const countryCode = selectedCountry?.code || 'LK'

  useEffect(() => {
    serviceCategories.list(countryCode).then((all) => {
      setCategories(all.filter((c: any) => !DUPLICATE_CATEGORIES.has(c.name.toLowerCase())))
    }).catch(() => {})
  }, [countryCode])

  const openSubServices = (cat: CategoryWithJobs) => {
    setSelectedCategory(cat)
    setModalVisible(true)
    Animated.timing(slideAnim, {
      toValue: 0, duration: 300, useNativeDriver: true,
    }).start()
  }

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true,
    }).start(() => {
      setModalVisible(false)
      setSelectedCategory(null)
    })
  }

  if (categories.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.tabsWrap}>
        {categories.map((cat) => {
          const cc = getCategoryColor(cat.name, isDark)
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.tab,
                { backgroundColor: cc.bg, borderColor: cc.border },
              ]}
              onPress={() => {
                onCategoryPress?.(cat.id, cat.name)
                if (cat.jobs.length > 0) openSubServices(cat)
              }}
              activeOpacity={0.7}
            >
              <CategoryIcon name={cat.name} size={16} color={cc.icon} />
              <Text style={[styles.tabLabel, { color: colors.ink }]} numberOfLines={1}>{cat.name}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeModal}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.sheetHandle}>
                <View style={[styles.handleBar, { backgroundColor: colors.muted }]} />
              </View>
              {selectedCategory && (
                <>
                  <View style={styles.sheetHeader}>
                    <CategoryIcon name={selectedCategory.name} size={28} color={getCategoryColor(selectedCategory.name, isDark).icon} />
                    <Text style={[styles.sheetTitle, { color: colors.ink }]}>{selectedCategory.name}</Text>
                    <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                      <Text style={[styles.closeBtnText, { color: colors.muted }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                    {selectedCategory.jobs.map((job) => (
                      <TouchableOpacity
                        key={job.id}
                        style={[styles.serviceItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          closeModal()
                          onServicePress?.(job.id, job.name)
                        }}
                      >
                        <View style={[styles.serviceIcon, { backgroundColor: getCategoryColor(selectedCategory.name, isDark).bg }]}>
                          <CategoryIcon name={selectedCategory.name} size={16} color={getCategoryColor(selectedCategory.name, isDark).icon} />
                        </View>
                        <Text style={[styles.serviceName, { color: colors.ink }]}>{job.name}</Text>
                        <Text style={[styles.serviceArrow, { color: colors.muted }]}>→</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

interface CatColor { bg: string; border: string; icon: string }

function getCategoryColor(name: string, isDark: boolean): CatColor {
  const n = name.toLowerCase()

  const darkMap: Record<string, CatColor> = {
    electrical:  { bg: '#2563EB18', border: '#2563EB30', icon: '#60A5FA' },
    plumb:       { bg: '#0284C718', border: '#0284C730', icon: '#38BDF8' },
    hvac:        { bg: '#EA580C18', border: '#EA580C30', icon: '#FB923C' },
    paint:       { bg: '#DB277718', border: '#DB277730', icon: '#F472B6' },
    carpent:     { bg: '#7C3AED18', border: '#7C3AED30', icon: '#A78BFA' },
    mason:       { bg: '#EF444418', border: '#EF444430', icon: '#F87171' },
    pest:        { bg: '#16A34A18', border: '#16A34A30', icon: '#4ADE80' },
    clean:       { bg: '#16A34A18', border: '#16A34A30', icon: '#34D399' },
    garden:      { bg: '#16A34A18', border: '#16A34A30', icon: '#4ADE80' },
    security:    { bg: '#EF444418', border: '#EF444430', icon: '#F87171' },
    moving:      { bg: '#7C3AED18', border: '#7C3AED30', icon: '#A78BFA' },
    car:         { bg: '#0891B218', border: '#0891B230', icon: '#22D3EE' },
    it:          { bg: '#6366F118', border: '#6366F130', icon: '#818CF8' },
    event:       { bg: '#C026D318', border: '#C026D330', icon: '#E879F9' },
    solar:       { bg: '#EA580C18', border: '#EA580C30', icon: '#FB923C' },
    personal:    { bg: '#E11D4818', border: '#E11D4830', icon: '#FB7185' },
    water:       { bg: '#0284C718', border: '#0284C730', icon: '#38BDF8' },
    handyman:    { bg: '#D4890018', border: '#D4890030', icon: '#FBBF24' },
  }

  if (isDark) {
    if (n.includes('electrical') || n.includes('electrician')) return darkMap.electrical
    if (n.includes('plumb')) return darkMap.plumb
    if (n.includes('ac') || n.includes('hvac') || n.includes('heating') || n.includes('furnace') || n.includes('refrigeration')) return darkMap.hvac
    if (n.includes('paint') || n.includes('decorat')) return darkMap.paint
    if (n.includes('carpent') || n.includes('furniture') || n.includes('floor') || n.includes('tile')) return darkMap.carpent
    if (n.includes('mason') || n.includes('concrete') || n.includes('roof') || n.includes('gutter') || n.includes('renovation') || n.includes('interior')) return darkMap.mason
    if (n.includes('pest') || n.includes('bug') || n.includes('insect') || n.includes('rodent')) return darkMap.pest
    if (n.includes('clean') || n.includes('disinfect')) return darkMap.clean
    if (n.includes('garden') || n.includes('lawn') || n.includes('landscap') || n.includes('plant') || n.includes('tree')) return darkMap.garden
    if (n.includes('security') || n.includes('cctv') || n.includes('alarm') || n.includes('lock')) return darkMap.security
    if (n.includes('moving') || n.includes('delivery') || n.includes('packing') || n.includes('lorry')) return darkMap.moving
    if (n.includes('car') || n.includes('vehicle') || n.includes('automotive') || n.includes('mechanic') || n.includes('wash') || n.includes('tire')) return darkMap.car
    if (n.includes('it ') || n.includes('computer') || n.includes('electronics') || n.includes('tech') || n.includes('printer') || n.includes('wifi')) return darkMap.it
    if (n.includes('event') || n.includes('party')) return darkMap.event
    if (n.includes('solar') || n.includes('energy')) return darkMap.solar
    if (n.includes('personal') || n.includes('wellness') || n.includes('care')) return darkMap.personal
    if (n.includes('water') || n.includes('tank')) return darkMap.water
    if (n.includes('home repair') || n.includes('assembly') || n.includes('mounting') || n.includes('handyman')) return darkMap.handyman
    return { bg: '#FFFFFF0D', border: '#FFFFFF18', icon: '#B3B3B3' }
  }

  if (n.includes('electrical') || n.includes('electrician')) return { bg: '#EFF6FF', border: '#93C5FD', icon: '#2563EB' }
  if (n.includes('plumb')) return { bg: '#E0F2FE', border: '#7DD3FC', icon: '#0284C7' }
  if (n.includes('ac') || n.includes('hvac') || n.includes('heating') || n.includes('furnace') || n.includes('refrigeration')) return { bg: '#FFF7ED', border: '#FDBA74', icon: '#EA580C' }
  if (n.includes('paint') || n.includes('decorat')) return { bg: '#FDF2F8', border: '#F9A8D4', icon: '#DB2777' }
  if (n.includes('carpent') || n.includes('furniture') || n.includes('floor') || n.includes('tile')) return { bg: '#F5F3FF', border: '#C4B5FD', icon: '#7C3AED' }
  if (n.includes('mason') || n.includes('concrete') || n.includes('roof') || n.includes('gutter') || n.includes('renovation') || n.includes('interior')) return { bg: '#FEF2F2', border: '#FCA5A5', icon: '#EF4444' }
  if (n.includes('pest') || n.includes('bug') || n.includes('insect') || n.includes('rodent')) return { bg: '#F0FDF4', border: '#86EFAC', icon: '#16A34A' }
  if (n.includes('clean') || n.includes('disinfect')) return { bg: '#ECFDF5', border: '#6EE7B7', icon: '#16A34A' }
  if (n.includes('garden') || n.includes('lawn') || n.includes('landscap') || n.includes('plant') || n.includes('tree')) return { bg: '#F0FDF4', border: '#86EFAC', icon: '#16A34A' }
  if (n.includes('security') || n.includes('cctv') || n.includes('alarm') || n.includes('lock')) return { bg: '#FEF2F2', border: '#FCA5A5', icon: '#EF4444' }
  if (n.includes('moving') || n.includes('delivery') || n.includes('packing') || n.includes('lorry')) return { bg: '#F5F3FF', border: '#C4B5FD', icon: '#7C3AED' }
  if (n.includes('car') || n.includes('vehicle') || n.includes('automotive') || n.includes('mechanic') || n.includes('wash') || n.includes('tire')) return { bg: '#ECFEFF', border: '#67E8F9', icon: '#0891B2' }
  if (n.includes('it ') || n.includes('computer') || n.includes('electronics') || n.includes('tech') || n.includes('printer') || n.includes('wifi')) return { bg: '#EEF2FF', border: '#A5B4FC', icon: '#6366F1' }
  if (n.includes('event') || n.includes('party')) return { bg: '#FDF4FF', border: '#F0ABFC', icon: '#C026D3' }
  if (n.includes('solar') || n.includes('energy')) return { bg: '#FFF7ED', border: '#FDBA74', icon: '#EA580C' }
  if (n.includes('personal') || n.includes('wellness') || n.includes('care')) return { bg: '#FFF1F2', border: '#FDA4AF', icon: '#E11D48' }
  if (n.includes('water') || n.includes('tank')) return { bg: '#E0F2FE', border: '#7DD3FC', icon: '#0284C7' }
  if (n.includes('home repair') || n.includes('assembly') || n.includes('mounting') || n.includes('handyman')) return { bg: '#FFFBEB', border: '#FCD34D', icon: '#D48900' }
  return { bg: '#F3F4F6', border: '#D1D5DB', icon: '#6B7280' }
}

function CategoryIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const n = name.toLowerCase()
  if (n.includes('electrical') || n.includes('electrician')) return <Lightning size={size} color={color} weight="fill" />
  if (n.includes('plumb')) return <Drop size={size} color={color} weight="bold" />
  if (n.includes('ac') || n.includes('hvac') || n.includes('heating') || n.includes('furnace') || n.includes('ventilation') || n.includes('duct') || n.includes('refrigeration')) return <Thermometer size={size} color={color} weight="bold" />
  if (n.includes('paint') || n.includes('decorat')) return <Palette size={size} color={color} weight="bold" />
  if (n.includes('carpent') || n.includes('furniture') || n.includes('floor') || n.includes('tile') || n.includes('mason') || n.includes('concrete') || n.includes('handyman') || n.includes('reno') || n.includes('interior')) return <Toolbox size={size} color={color} weight="bold" />
  if (n.includes('roof') || n.includes('gutter') || n.includes('home repair') || n.includes('home-repair')) return <Wrench size={size} color={color} weight="bold" />
  if (n.includes('pest') || n.includes('bug') || n.includes('insect') || n.includes('rodent') || n.includes('cockroach') || n.includes('termite')) return <Bug size={size} color={color} weight="bold" />
  if (n.includes('clean') || n.includes('disinfect')) return <Sparkle size={size} color={color} weight="fill" />
  if (n.includes('garden') || n.includes('lawn') || n.includes('landscap') || n.includes('tree') || n.includes('plant')) return <Leaf size={size} color={color} weight="bold" />
  if (n.includes('security') || n.includes('cctv') || n.includes('alarm') || n.includes('smart lock')) return <ShieldCheck size={size} color={color} weight="fill" />
  if (n.includes('moving') || n.includes('delivery') || n.includes('pack') || n.includes('lorry') || n.includes('truck')) return <Truck size={size} color={color} weight="bold" />
  if (n.includes('car') || n.includes('vehicle') || n.includes('automotive') || n.includes('tire') || n.includes('battery') || n.includes('mechanic') || n.includes('wash')) return <Car size={size} color={color} weight="bold" />
  if (n.includes('it') || n.includes('computer') || n.includes('electronics') || n.includes('repair') || n.includes('printer') || n.includes('wifi') || n.includes('website') || n.includes('app development') || n.includes('tech')) return <Monitor size={size} color={color} weight="bold" />
  if (n.includes('event') || n.includes('party')) return <Basketball size={size} color={color} weight="bold" />
  if (n.includes('solar') || n.includes('energy')) return <Sun size={size} color={color} weight="bold" />
  if (n.includes('personal') || n.includes('wellness') || n.includes('care')) return <Heart size={size} color={color} weight="bold" />
  if (n.includes('water') || n.includes('tank')) return <Drop size={size} color={color} weight="bold" />
  return <Wrench size={size} color={color} weight="bold" />
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { marginVertical: 8 },
  tabsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 8,
    borderRadius: 100, borderWidth: 1, gap: 4,
  },
  tabLabel: { fontSize: 11, fontFamily: fonts?.bodyMedium || 'Inter_500Medium' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.65, paddingBottom: 32,
  },
  sheetHandle: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handleBar: { width: 32, height: 3, borderRadius: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, gap: 10 },
  sheetEmoji: { fontSize: 24 },
  sheetTitle: { flex: 1, fontSize: 17, fontFamily: fonts?.heading || 'Inter_600SemiBold' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 12, fontFamily: fonts?.bodyMedium || 'Inter_500Medium' },
  sheetScroll: { paddingHorizontal: 16 },
  serviceItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 0.5, gap: 10,
  },
  serviceIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  serviceEmoji: { fontSize: 16 },
  serviceName: { flex: 1, fontSize: 14, fontFamily: fonts?.body || 'Inter_400Regular' },
  serviceArrow: { fontSize: 14, fontFamily: fonts?.body || 'Inter_400Regular' },
})
