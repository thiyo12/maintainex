import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing, Platform, ActivityIndicator, Keyboard } from 'react-native'
import { Sparkle, ArrowRight, X, MagnifyingGlass, Lightning, Drop, Snowflake, Palette, Hammer, GridFour, Wrench, House, Bug, Leaf, LockSimple, Car, CarProfile, Desktop, MusicNotes, Person, Building, Sun, PlusCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { fonts } from '../../lib/fonts'
import { v2Search } from '../../lib/api-v2'
import { taskers } from '../../lib/api'
import { buildSampleTaskers } from '../../lib/sampleTaskers'

const SAMPLE_TASKER_RESULTS: TaskerResult[] = buildSampleTaskers(null).map((s, i) => ({
  id: s.id,
  userId: s.userId,
  bio: s.bio,
  hourlyRate: s.hourlyRate || 1500,
  skills: s.skills,
  rating: s.rating,
  completedJobs: s.completedJobs,
  isVerified: s.isVerified,
  isOnline: s.isOnline,
  user: { id: s.userId, name: s.name, phone: '', email: '' },
}))

interface CategoryResult {
  id: string; name: string; icon: string; colorHex: string; score: number; correctedQuery?: string
}
interface SubServiceResult {
  id: string; name: string; categoryId: string; categoryName: string; categoryIcon: string; categoryColor: string; score: number
}
interface TaskerResult {
  id: string
  userId: string
  bio: string
  hourlyRate: number
  skills: string[]
  rating: number
  completedJobs: number
  isVerified: boolean
  isOnline: boolean
  user: { id: string; name: string; phone: string; email: string }
}

interface Props {
  value?: string
  onChangeText?: (t: string) => void
  onSearch?: () => void
  onCategorySelect?: (categoryId: string, categoryName: string) => void
  onJobSelect?: (jobId: string, jobName: string, categoryId?: string) => void
  onTaskerSelect?: (taskerId: string) => void
  onPostJob?: (query: string) => void
  placeholder?: string
  showSuggestions?: boolean
  autoFocus?: boolean
}

const ICON_MAP: Record<string, any> = {
  flash: Lightning, water: Drop, snowflake: Snowflake, 'color-palette': Palette,
  hammer: Hammer, grid: GridFour, construct: Wrench, home: House,
  bug: Bug, sparkles: Sparkle, leaf: Leaf, 'lock-closed': LockSimple,
  car: Car, 'car-sport': CarProfile, desktop: Desktop, 'musical-notes': MusicNotes,
  body: Person, business: Building, sunny: Sun,
}

function CategoryIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = ICON_MAP[name] || Wrench
  return <Icon size={size} color={color} weight="fill" />
}

export default function AISearchBar({
  value: controlledValue, onChangeText: controlledOnChangeText, onSearch,
  onCategorySelect, onJobSelect, onTaskerSelect, onPostJob,
  placeholder, showSuggestions = true, autoFocus = false,
}: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const glowRadius = useRef(new Animated.Value(8)).current
  const glowOp = useRef(new Animated.Value(0.2)).current
  const sparkScale = useRef(new Animated.Value(1)).current

  const [internalValue, setInternalValue] = useState('')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue! : internalValue
  const onChangeText = isControlled ? controlledOnChangeText! : setInternalValue

  const [focused, setFocused] = useState(false)

  const [categories, setCategories] = useState<CategoryResult[]>([])
  const [subServices, setSubServices] = useState<SubServiceResult[]>([])
  const [taskerResults, setTaskerResults] = useState<TaskerResult[]>([])
  const [taskersLoading, setTaskersLoading] = useState(false)
  const [correctedQuery, setCorrectedQuery] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const isDisposedRef = useRef(false)

  useEffect(() => { return () => { isDisposedRef.current = true } }, [])

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(sparkScale, { toValue: 1.2, duration: 1800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sparkScale, { toValue: 1.0, duration: 1800, useNativeDriver: true }),
      ]),
    ])).start()
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!showSuggestions || q.trim().length < 2) {
      setCategories([]); setSubServices([]); setTaskerResults([]); setCorrectedQuery(undefined)
      setShowDropdown(false)
      return
    }
    setLoading(true)
    try {
      const data = await v2Search.categories(q)
      const cats = data.categories || []
      const subs = data.subServices || []
      setCategories(cats)
      setSubServices(subs)
      setCorrectedQuery(data.correctedQuery)
      setShowDropdown(true)
      if (cats.length > 0 || subs.length > 0) {
        const key = (subs[0]?.categoryId) || (cats[0]?.id) || ''
        setTaskersLoading(true)
        taskers.list(`category=${encodeURIComponent(key)}`)
          .then((list) => {
            if (isDisposedRef.current) return
            const real = (list || []).slice(0, 3)
            setTaskerResults(real.length > 0 ? real : SAMPLE_TASKER_RESULTS)
          })
          .catch(() => { if (!isDisposedRef.current) setTaskerResults([]) })
          .finally(() => { if (!isDisposedRef.current) setTaskersLoading(false) })
      } else {
        setTaskerResults([])
      }
    } catch {
      setCategories([]); setSubServices([]); setTaskerResults([]); setCorrectedQuery(undefined)
    } finally { setLoading(false) }
  }, [showSuggestions])

  const handleChange = useCallback((text: string) => {
    onChangeText(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(text), 250)
  }, [onChangeText, doSearch])

  const handleClear = () => {
    onChangeText('')
    setCategories([]); setSubServices([]); setTaskerResults([]); setCorrectedQuery(undefined)
    setShowDropdown(false)
  }

  const handleSubmit = () => {
    Keyboard.dismiss()
    setShowDropdown(false)
    onSearch?.()
  }

  const handleCategoryTap = (cat: CategoryResult) => {
    setShowDropdown(false)
    onCategorySelect?.(cat.id, cat.name)
  }

  const handleSubServiceTap = (sub: SubServiceResult) => {
    setShowDropdown(false)
    onJobSelect?.(sub.id, sub.name, sub.categoryId)
  }

  const handleTaskerTap = (tasker: TaskerResult) => {
    setShowDropdown(false)
    Keyboard.dismiss()
    onTaskerSelect?.(tasker.id)
  }

  const handleCorrectedTap = () => {
    if (correctedQuery) {
      onChangeText(correctedQuery)
      doSearch(correctedQuery)
    }
  }

  const hasResults = categories.length > 0 || subServices.length > 0 || taskerResults.length > 0

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'ios' ? (
        <Animated.View style={[styles.glowLayer, {
          shadowColor: colors.amber,
          shadowOpacity: focused ? 0.45 : glowOp,
          shadowRadius: focused ? 22 : glowRadius,
          shadowOffset: { width: 0, height: 0 },
        }]} />
      ) : (
        <Animated.View style={[styles.androidGlow, {
          opacity: focused ? 0.3 : glowOp,
          transform: [{ scale: sparkScale }],
        }]} />
      )}
      <Animated.View style={[styles.leftIcon, { transform: [{ scale: focused ? 1 : sparkScale }] }]}>
        <MagnifyingGlass size={18} color={colors.amber} weight="fill" />
      </Animated.View>
      <TextInput
        style={[styles.input, { color: colors.ink, backgroundColor: colors.surface, borderColor: focused ? colors.amber : colors.border }]}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder || t('home.searchPlaceholder')}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
        autoFocus={autoFocus}
        onFocus={() => { setFocused(true); if (hasResults) setShowDropdown(true) }}
        onBlur={() => setFocused(false)}
      />
      {value.length > 0 ? (
        <TouchableOpacity style={[styles.clearBtn]} onPress={handleClear}>
          <X size={14} color={colors.muted} weight="bold" />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.sendBtn, {
          backgroundColor: colors.amber,
          shadowColor: colors.amber, shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
        }]}
        onPress={handleSubmit}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size={14} color="#111827" />
        ) : (
          <ArrowRight size={14} color="#111827" weight="bold" />
        )}
      </TouchableOpacity>

      {showDropdown && showSuggestions && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 360 }}>
            {correctedQuery && (
              <TouchableOpacity style={[styles.correctedRow, { borderBottomColor: colors.border }]} onPress={handleCorrectedTap}>
                <Sparkle size={14} color={colors.amber} weight="fill" />
                <Text style={[styles.correctedText, { color: colors.ink }]}>
                  {t('search.didYouMean') || 'Did you mean:'} <Text style={{ color: colors.amber, fontWeight: '700' }}>{correctedQuery}</Text>?
                </Text>
              </TouchableOpacity>
            )}

            {categories.length > 0 && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('search.categories') || 'Categories'}</Text>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.resultRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleCategoryTap(cat)}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: cat.colorHex + '18' }]}>
                      <CategoryIcon name={cat.icon} size={18} color={cat.colorHex} />
                    </View>
                    <Text style={[styles.resultName, { color: colors.ink }]} numberOfLines={1}>{cat.name}</Text>
                    <Text style={[styles.resultScore, { color: colors.muted }]}>{cat.score}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {subServices.length > 0 && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('search.services') || 'Services'}</Text>
                {subServices.map((sub) => (
                  <TouchableOpacity
                    key={`${sub.categoryId}-${sub.id}`}
                    style={[styles.resultRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleSubServiceTap(sub)}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: sub.categoryColor + '18' }]}>
                      <CategoryIcon name={sub.categoryIcon} size={14} color={sub.categoryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultName, { color: colors.ink }]} numberOfLines={1}>{sub.name}</Text>
                      <Text style={[styles.resultSub, { color: colors.muted }]} numberOfLines={1}>{sub.categoryName}</Text>
                    </View>
                    <Text style={[styles.resultScore, { color: colors.muted }]}>{sub.score}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {(taskersLoading || taskerResults.length > 0) && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>{t('search.nearbyProviders') || 'Taskers near you'}</Text>
                {taskersLoading ? (
                  <ActivityIndicator size="small" color={colors.amber} style={{ paddingVertical: 12 }} />
                ) : taskerResults.map((tasker) => (
                  <TouchableOpacity
                    key={tasker.id}
                    style={[styles.resultRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleTaskerTap(tasker)}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: colors.amber + '18' }]}>
                      <Sparkle size={16} color={colors.amberDark} weight="fill" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultName, { color: colors.ink }]} numberOfLines={1}>{tasker.user?.name || 'Tasker'}</Text>
                      <Text style={[styles.resultSub, { color: colors.muted }]} numberOfLines={1}>
                        ⭐ {tasker.rating?.toFixed(1) ?? 'New'} · {tasker.completedJobs || 0} jobs done
                      </Text>
                    </View>
                    <ArrowRight size={14} color={colors.amberDark} weight="bold" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!loading && !hasResults && value.length >= 2 && (
              <View style={styles.emptyWrap}>
                <MagnifyingGlass size={24} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>{t('search.noResults') || 'No results found'}</Text>
              </View>
            )}

            {value.length >= 2 && (
              <TouchableOpacity
                style={[styles.postJobRow, { borderTopColor: colors.border }]}
                onPress={() => {
                  setShowDropdown(false)
                  Keyboard.dismiss()
                  onPostJob?.(value)
                }}
              >
                <View style={[styles.postJobIcon, { backgroundColor: colors.amber + '18' }]}>
                  <PlusCircle size={18} color={colors.amberDark} weight="fill" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.postJobLabel, { color: colors.amberDark }]}>{t('search.postThisJob')}</Text>
                  <Text style={[styles.postJobHint, { color: colors.muted }]} numberOfLines={1}>"{value}"</Text>
                </View>
                <ArrowRight size={14} color={colors.amberDark} weight="bold" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  wrap: { marginHorizontal: 8, marginBottom: 8, position: 'relative', zIndex: 100 },
  glowLayer: { position: 'absolute', inset: -6, borderRadius: 24, backgroundColor: 'transparent', zIndex: 0 },
  androidGlow: { position: 'absolute', inset: -4, borderRadius: 22, backgroundColor: 'rgba(245,158,11,0.12)', zIndex: 0 },
  leftIcon: { position: 'absolute', left: 16, top: '50%', marginTop: -8, zIndex: 2 },
  input: {
    height: 54, borderRadius: 18, borderWidth: 1.5,
    paddingLeft: 44, paddingRight: 72,
    fontSize: 15, fontFamily: fonts.bodyMedium, zIndex: 1,
  },
  clearBtn: {
    position: 'absolute', right: 44, top: '50%', marginTop: -11,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  sendBtn: {
    position: 'absolute', right: 8, top: '50%', marginTop: -15,
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  dropdown: {
    position: 'absolute', top: 58, left: 0, right: 0,
    borderRadius: 16, borderWidth: 1, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1,
    shadowRadius: 16, elevation: 8, zIndex: 1000,
    overflow: 'hidden',
  },
  correctedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  correctedText: { fontSize: 13, fontFamily: fonts.body, flex: 1 },
  sectionWrap: { paddingHorizontal: 12, paddingVertical: 6 },
  sectionLabel: { fontSize: 11, fontFamily: fonts.bodyMedium, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4, marginBottom: 4 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 0.5,
  },
  resultIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  resultName: { flex: 1, fontSize: 14, fontFamily: fonts.bodyMedium },
  resultSub: { fontSize: 11, fontFamily: fonts.body, marginTop: 1 },
  resultScore: { fontSize: 11, fontFamily: fonts.body },
  emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: fonts.body },
  postJobRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 0.5,
  },
  postJobIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  postJobLabel: { fontSize: 14, fontFamily: fonts.headingBold },
  postJobHint: { fontSize: 11, fontFamily: fonts.body, marginTop: 1 },
})
