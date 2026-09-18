import { useEffect, useMemo, useCallback, useState, useSyncExternalStore } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Image } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Bell, Briefcase, ChatCircle, Heart, MagnifyingGlass, MapPin, Microphone, Plus, Wrench } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../../lib/auth'
import { v2Jobs, v2Quotes, v2Match } from '../../../lib/api-v2'
import { taskers, notifications, realEstate } from '../../../lib/api'
import { translateJobStatus } from '../../../lib/i18n'
import { on, removedJobs, subscribe, getVersion } from '../../../lib/events'
import { CATEGORY_FALLBACK } from '../../../lib/categoryVisuals'
import { v3 } from '../../../theme/v3/tokens'

import V3CustomerBottomNav from '../../../components/v3/V3CustomerBottomNav'
import AvatarCircle from '../../../components/ui/AvatarCircle'

const TRACKABLE = ['QUOTE_ACCEPTED', 'PENDING_PAYMENT', 'ESCROW_DEPOSITED', 'IN_PROGRESS']

const money = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `LKR ${n.toLocaleString()}` : null
}

export default function CustomerHome() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const { newJobId } = useLocalSearchParams<{ newJobId?: string }>()

  const [myJobs, setMyJobs] = useState<any[]>([])
  const [quoteCounts, setQuoteCounts] = useState<Record<string, number>>({})
  const [relatedProviders, setRelatedProviders] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [homeCategories, setHomeCategories] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])

  const userId = user?.id

  const ownJobs = useMemo(
    () => myJobs.filter(j => !removedJobs.has(j.id) && (j.customerId === userId || (newJobId && j.id === newJobId))),
    [myJobs, userId, newJobId]
  )

  const activeJob = useMemo(
    () => ownJobs.find(j => TRACKABLE.includes(j.status) || (j.acceptedQuote && !['COMPLETED', 'CANCELLED'].includes(j.status))),
    [ownJobs]
  )

  const region = useMemo(
    () => user?.area || user?.city || user?.province || user?.region || activeJob?.locationName?.split(',')[0] || 'Colombo 05',
    [user, activeJob]
  )

  const loadHomeCategories = useCallback(async () => {
    setHomeCategories(CATEGORY_FALLBACK)
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'}/api/mobile/job-categories`)
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.categories || data.data || []
      if (list.length > 0) setHomeCategories(list)
    } catch {}
  }, [])

  const loadProperties = useCallback(async () => {
    try {
      const data = await realEstate.list({ status: 'ACTIVE' })
      const list = Array.isArray(data) ? data : []
      setProperties(list.slice(0, 4))
    } catch {}
  }, [])

  const loadJobs = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      loadHomeCategories()
      loadProperties()

      const res = await v2Jobs.list()
      const jobs = res.jobs || []
      setMyJobs(jobs)

      const own = jobs.filter((j: any) => j.customerId === userId || (newJobId && j.id === newJobId))
      if (own.length > 0) {
        const qResults = await Promise.allSettled(own.map((j: any) => v2Quotes.list(j.id)))
        const counts: Record<string, number> = {}
        own.forEach((j: any, i: number) => {
          const r = qResults[i]
          counts[j.id] = r.status === 'fulfilled' ? (r.value.quotes || []).filter((q: any) => q.status === 'PENDING').length : 0
        })
        setQuoteCounts(counts)
      } else {
        setQuoteCounts({})
      }

      const targetJobId = newJobId || (own.length > 0 ? own[0].id : null)
      if (targetJobId) {
        const [matchRes, allTaskersRes] = await Promise.allSettled([v2Match.getProviders(targetJobId), taskers.list()])
        const matched = matchRes.status === 'fulfilled' ? (matchRes.value.providers || []) : []
        const others = allTaskersRes.status === 'fulfilled' ? (allTaskersRes.value || []) : []
        const seen = new Set<string>()
        const merged: any[] = []
        const add = (p: any) => {
          if (p?.id && !seen.has(p.id)) {
            seen.add(p.id)
            merged.push(p)
          }
        }
        matched.forEach(add)
        others.forEach(add)
        setRelatedProviders(merged.slice(0, 10))
      } else {
        const allTaskers = await taskers.list().catch(() => null)
        setRelatedProviders(((allTaskers || []) as any[]).slice(0, 10))
      }

      notifications.unreadCount().then((r: any) => setUnreadCount(r.count || 0)).catch(() => {})
    } catch (e) {
      console.error('Load jobs error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userId, newJobId, loadHomeCategories, loadProperties])

  useEffect(() => {
    const unsub = on('jobsChanged', () => setRefreshKey(k => k + 1))
    return () => unsub()
  }, [])

  useSyncExternalStore(subscribe, getVersion)
  useEffect(() => { if (refreshKey > 0) loadJobs() }, [refreshKey, loadJobs])
  useEffect(() => { loadJobs() }, [loadJobs])

  const openCategoryDetail = (id: string) => {
    router.push({ pathname: '/(customer)/find/[categoryId]', params: { categoryId: id } } as any)
  }

  const navToActive = () => {
    if (!activeJob) return
    if (TRACKABLE.includes(activeJob.status)) router.push(`/(customer)/tracking/${activeJob.id}`)
    else router.push(`/(customer)/jobs/v2/${activeJob.id}`)
  }

  const provider = activeJob?.acceptedQuote?.provider || activeJob?.provider
  const quick = (homeCategories.length > 0 ? homeCategories : CATEGORY_FALLBACK).slice(0, 3)
  const featuredProperty = properties[0]
  const secondProperty = properties[1]
  const propertyImage = featuredProperty?.images?.[0] || featuredProperty?.imageUrl || featuredProperty?.photoUrl
  const secondImage = secondProperty?.images?.[0] || secondProperty?.imageUrl || secondProperty?.photoUrl
  const acceptedAmount = money(activeJob?.acceptedQuote?.amount || activeJob?.acceptedQuote?.price || activeJob?.budget)
  const eta = activeJob?.acceptedQuote?.etaMinutes || activeJob?.etaMinutes

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={v3.colors.ink} />}
      >
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>MΛINTΛINEX</Text>
            <TouchableOpacity style={styles.locationRow} onPress={() => router.push('/(customer)/settings/addresses' as any)} activeOpacity={0.7}>
              <MapPin size={14} color={v3.colors.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>{region}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={() => router.push('/(customer)/(tabs)/notifications' as any)} activeOpacity={0.7}>
            <Bell size={17} color={v3.colors.ink} weight="fill" />
            {unreadCount > 0 ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>What can we solve today?</Text>
        <Text style={styles.heroSubtitle}>Post a job, find a pro, or book a stay.</Text>

        <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(customer)/find' as any)} activeOpacity={0.75}>
          <MagnifyingGlass size={18} color={v3.colors.ink} />
          <Text style={styles.searchText}>Describe a job or search anything</Text>
          <View style={styles.voiceCircle}>
            <Microphone size={15} color={v3.colors.ink} weight="bold" />
          </View>
        </TouchableOpacity>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Quick start</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/find' as any)}>
            <Text style={styles.sectionLink}>All services →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          {quick.map((item: any, index: number) => {
            const id = item.id || item.slug || String(index)
            const label = item.name || item.slug || ['Clean', 'Repair', 'AC'][index]
            const sub = ['Today', 'Fast quote', 'Near you'][index] || 'Near you'
            return (
              <TouchableOpacity
                key={id}
                style={[styles.quickCard, index === 1 && styles.quickCardAccent]}
                onPress={() => openCategoryDetail(id)}
                activeOpacity={0.75}
              >
                <Text style={styles.quickName} numberOfLines={1}>{label}</Text>
                <Text style={styles.quickSub}>{sub}</Text>
              </TouchableOpacity>
            )
          })}
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(customer)/find' as any)} activeOpacity={0.75}>
            <Text style={styles.quickName}>All</Text>
            <Text style={styles.quickSub}>100+ services</Text>
          </TouchableOpacity>
        </View>

        {activeJob ? (
          <TouchableOpacity style={styles.activeCard} onPress={navToActive} activeOpacity={0.85}>
            <Text style={styles.activeEyebrow}>ACTIVE JOB · {String(t(translateJobStatus(activeJob.status))).toUpperCase()}</Text>
            <Text style={styles.activeTitle} numberOfLines={1}>{activeJob.title || 'Your active job'}</Text>
            <View style={styles.activeBottomRow}>
              <View style={styles.activeProviderRow}>
                <AvatarCircle
                  uri={provider?.avatarUrl || provider?.profilePhoto || provider?.imageUrl}
                  name={provider?.name || 'Tasker'}
                  size={36}
                  showOnline
                />
                <Text style={styles.activeMeta} numberOfLines={1}>
                  {provider?.name || 'Tasker'}{eta ? ` · ${eta} min` : ''}{acceptedAmount ? ` · ${acceptedAmount}` : ''}
                </Text>
              </View>
              <View style={styles.trackButton}>
                <Text style={styles.trackButtonText}>Track</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Your shortcuts</Text>
          <Text style={styles.sectionHint}>Fast access</Text>
        </View>

        <View style={styles.shortcutGrid}>
          <TouchableOpacity activeOpacity={0.78} style={styles.shortcutCard} onPress={() => router.push('/(customer)/jobs/v2/create' as any)}>
            <View style={[styles.shortcutIcon, { backgroundColor: v3.colors.ink }]}>
              <Plus size={19} color={v3.colors.paper} weight="bold" />
            </View>
            <Text style={styles.shortcutTitle}>Post a job</Text>
            <Text style={styles.shortcutMeta}>Describe it in seconds</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.78} style={styles.shortcutCard} onPress={() => router.push('/(customer)/find' as any)}>
            <View style={[styles.shortcutIcon, { backgroundColor: v3.colors.amberSoft }]}>
              <Wrench size={19} color={v3.colors.ink} weight="fill" />
            </View>
            <Text style={styles.shortcutTitle}>Find a pro</Text>
            <Text style={styles.shortcutMeta}>Browse trusted taskers</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.78} style={styles.shortcutCard} onPress={() => router.push('/(customer)/(tabs)/activity' as any)}>
            <View style={[styles.shortcutIcon, { backgroundColor: v3.colors.infoSoft }]}>
              <Briefcase size={19} color={v3.colors.info} weight="fill" />
            </View>
            <Text style={styles.shortcutTitle}>My jobs</Text>
            <Text style={styles.shortcutMeta}>Track quotes & progress</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.78} style={styles.shortcutCard} onPress={() => router.push('/(chat)' as any)}>
            <View style={[styles.shortcutIcon, { backgroundColor: v3.colors.successSoft }]}>
              <ChatCircle size={19} color={v3.colors.success} weight="fill" />
            </View>
            <Text style={styles.shortcutTitle}>Messages</Text>
            <Text style={styles.shortcutMeta}>Taskers, companies, owners</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Available now</Text>
          <TouchableOpacity onPress={() => router.push('/(customer)/find' as any)}>
            <Text style={styles.sectionLink}>See taskers →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.taskerRow}>
          {(relatedProviders.length > 0 ? relatedProviders : []).slice(0, 8).map((p: any) => (
            <TouchableOpacity key={p.id} style={styles.taskerMini} onPress={() => router.push(`/(customer)/find/tasker-profile/${p.id}` as any)}>
              <AvatarCircle
                uri={p.avatarUrl || p.profilePhoto || p.imageUrl}
                name={p.name || 'Tasker'}
                size={36}
                showOnline
              />
              <Text style={styles.taskerName} numberOfLines={1}>{(p.name || 'Tasker').split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
          {!loading && relatedProviders.length === 0 ? <Text style={styles.emptyHint}>No taskers online right now.</Text> : null}
        </ScrollView>

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Stay & rent</Text>
          <TouchableOpacity onPress={() => router.push('/real-estate' as any)}>
            <Text style={styles.sectionLink}>Property hub →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propertyTabs}>
          <TouchableOpacity style={styles.propertyTabActive} onPress={() => router.push('/real-estate' as any)}>
            <Text style={styles.propertyTabActiveText}>Daily</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.propertyTab} onPress={() => router.push('/real-estate' as any)}>
            <Text style={styles.propertyTabText}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.propertyTab} onPress={() => router.push('/real-estate' as any)}>
            <Text style={styles.propertyTabText}>Rooms</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.propertyTabWide} onPress={() => router.push('/real-estate/upload' as any)}>
            <Text style={styles.propertyTabText}>List yours</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buyLink} onPress={() => router.push('/real-estate' as any)}>
            <Text style={styles.buyLinkText}>Buy & land</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.propertyRow}>
          <TouchableOpacity
            style={styles.propertyMainCard}
            onPress={() => featuredProperty?.id && router.push(`/real-estate/${featuredProperty.id}` as any)}
            activeOpacity={featuredProperty ? 0.8 : 1}
          >
            <View style={styles.propertyImageWrap}>
              {propertyImage ? <Image source={{ uri: propertyImage }} style={styles.propertyImage} resizeMode="cover" /> : <View style={styles.propertyPlaceholder} />}
              <View style={styles.propertyBadge}><Text style={styles.propertyBadgeText}>DAILY STAY</Text></View>
              <View style={styles.heartButton}><Heart size={16} color={v3.colors.ink} /></View>
            </View>
            <Text style={styles.propertyPrice} numberOfLines={1}>
              {featuredProperty?.nightlyPrice ? `${money(featuredProperty.nightlyPrice)} / night` : featuredProperty?.price ? money(featuredProperty.price) : 'LKR 8,500 / night'}
            </Text>
            <Text style={styles.propertyTitle} numberOfLines={1}>{featuredProperty?.title || 'Entire home'}</Text>
            <View style={styles.propertyMetaRow}>
              <MapPin size={12} color={v3.colors.textSecondary} />
              <Text style={styles.propertyMeta} numberOfLines={1}>{featuredProperty?.location || featuredProperty?.city || 'Near you'} · Instant request</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.propertySmallCard}
            onPress={() => secondProperty?.id && router.push(`/real-estate/${secondProperty.id}` as any)}
            activeOpacity={secondProperty ? 0.8 : 1}
          >
            <View style={styles.propertySmallImageWrap}>
              {secondImage ? <Image source={{ uri: secondImage }} style={styles.propertyImage} resizeMode="cover" /> : <View style={[styles.propertyPlaceholder, styles.propertyPlaceholderWarm]} />}
              <View style={styles.monthlyBadge}><Text style={styles.monthlyBadgeText}>MONTHLY</Text></View>
            </View>
            <Text style={styles.smallPropertyPrice} numberOfLines={1}>{secondProperty?.rentPrice ? money(secondProperty.rentPrice) : secondProperty?.price ? money(secondProperty.price) : 'LKR 95K'}</Text>
            <Text style={styles.smallPropertyLocation} numberOfLines={1}>{secondProperty?.location || secondProperty?.city || 'Colombo'}</Text>
            <Text style={styles.smallPropertyMeta} numberOfLines={1}>{secondProperty?.bedrooms ? `${secondProperty.bedrooms}BR` : '2BR'} · furnished</Text>
          </TouchableOpacity>
        </View>


        <View style={{ height: 112 }} />
      </ScrollView>

      <V3CustomerBottomNav
        activeTab="home"
        onTabPress={(tab) => {
          if (tab === 'home') return
          if (tab === 'explore') router.push('/(customer)/find' as any)
          else router.push(`/(customer)/(tabs)/${tab}` as any)
        }}
        onPostJob={() => router.push('/(customer)/jobs/v2/create' as any)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: v3.colors.canvas },
  scroll: { paddingBottom: 12 },

  brandRow: {
    paddingHorizontal: 18,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 13,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.ink,
    letterSpacing: 0.8,
  },
  locationRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 220,
  },
  locationText: {
    fontSize: 10.5,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.textSecondary,
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: v3.colors.amber,
    borderWidth: 1.5,
    borderColor: v3.colors.paper,
  },

  heroTitle: {
    marginTop: 14,
    paddingHorizontal: 18,
    fontSize: 25,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.ink,
    letterSpacing: -0.25,
  },
  heroSubtitle: {
    paddingHorizontal: 18,
    marginTop: 4,
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textSecondary,
  },

  searchBar: {
    marginHorizontal: 18,
    marginTop: 12,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: v3.colors.line,
    backgroundColor: v3.colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchText: {
    flex: 1,
    marginLeft: 14,
    fontSize: 12.5,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textSecondary,
  },
  voiceCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitleRow: {
    marginTop: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 14.5,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.ink,
  },
  sectionLink: {
    fontSize: 9.8,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#4F4F4F',
  },
  sectionHint: { fontSize: 9.8, fontFamily: 'Outfit_700Bold', color: v3.colors.textMuted },
  shortcutGrid: {
    marginTop: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutCard: {
    width: '48.5%',
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    padding: 13,
  },
  shortcutIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 11,
  },
  shortcutTitle: { fontFamily: 'Outfit_800ExtraBold', fontSize: 13.5, color: v3.colors.ink },
  shortcutMeta: { marginTop: 3, fontFamily: 'Outfit_400Regular', fontSize: 10.5, lineHeight: 14, color: v3.colors.textSecondary },

  quickRow: {
    marginTop: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 9,
  },
  quickCard: {
    flex: 1,
    minWidth: 0,
    height: 74,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 11,
    paddingTop: 15,
  },
  quickCardAccent: { backgroundColor: v3.colors.amberSoft },
  quickName: {
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    color: v3.colors.ink,
  },
  quickSub: {
    marginTop: 10,
    fontSize: 8.5,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textSecondary,
  },

  activeCard: {
    marginHorizontal: 18,
    marginTop: 14,
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: v3.colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  activeEyebrow: {
    fontSize: 8.4,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.amber,
    letterSpacing: 0.5,
  },
  activeTitle: {
    marginTop: 8,
    fontSize: 15.5,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.paper,
  },
  activeBottomRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  activeProviderRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeMeta: {
    flex: 1,
    fontSize: 9.4,
    fontFamily: 'Outfit_600SemiBold',
    color: '#CFCFCF',
  },
  trackButton: {
    minWidth: 60,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: v3.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackButtonText: {
    fontSize: 10.5,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.ink,
  },

  propertyTabs: {
    marginTop: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  propertyTabActive: {
    height: 32,
    minWidth: 58,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyTabActiveText: { fontSize: 10.5, fontFamily: 'Outfit_700Bold', color: v3.colors.paper },
  propertyTab: {
    height: 32,
    minWidth: 62,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: '#F1F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyTabWide: {
    height: 32,
    minWidth: 74,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: '#F1F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyTabText: { fontSize: 10.5, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  buyLink: { height: 32, justifyContent: 'center', paddingLeft: 6 },
  buyLinkText: { fontSize: 8.8, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.textSecondary },

  propertyRow: {
    marginTop: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 12,
  },
  propertyMainCard: {
    width: 244,
    height: 156,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    overflow: 'hidden',
  },
  propertyImageWrap: { height: 88, backgroundColor: '#DCE7E1' },
  propertySmallCard: {
    width: 98,
    height: 156,
    borderRadius: 18,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    overflow: 'hidden',
  },
  propertySmallImageWrap: { height: 82, backgroundColor: '#E7DED4' },
  propertyImage: { width: '100%', height: '100%' },
  propertyPlaceholder: { flex: 1, backgroundColor: '#DCE7E1' },
  propertyPlaceholderWarm: { backgroundColor: '#E7DED4' },
  propertyBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    minWidth: 72,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: v3.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyBadgeText: { fontSize: 8.8, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.paper },
  monthlyBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    minWidth: 66,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: v3.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyBadgeText: { fontSize: 8.8, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
  heartButton: {
    position: 'absolute',
    right: 7,
    top: 9,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: v3.colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyPrice: {
    marginTop: 9,
    marginHorizontal: 11,
    fontSize: 14.2,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.ink,
  },
  propertyTitle: {
    marginTop: 2,
    marginHorizontal: 11,
    fontSize: 10.5,
    fontFamily: 'Outfit_700Bold',
    color: v3.colors.ink,
  },
  propertyMetaRow: {
    marginTop: 5,
    marginHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  propertyMeta: {
    flex: 1,
    fontSize: 8.3,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textSecondary,
  },
  smallPropertyPrice: {
    marginTop: 9,
    marginHorizontal: 11,
    fontSize: 12,
    fontFamily: 'Outfit_900Black',
    color: v3.colors.ink,
  },
  smallPropertyLocation: {
    marginTop: 2,
    marginHorizontal: 11,
    fontSize: 8.5,
    fontFamily: 'Outfit_700Bold',
    color: '#4F4F4F',
  },
  smallPropertyMeta: {
    marginTop: 6,
    marginHorizontal: 11,
    fontSize: 8.2,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textSecondary,
  },

  taskerRow: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 18,
    alignItems: 'flex-start',
  },
  taskerMini: { width: 48, alignItems: 'center' },
  taskerName: {
    marginTop: 5,
    width: 54,
    textAlign: 'center',
    fontSize: 8.2,
    fontFamily: 'Outfit_700Bold',
    color: '#4F4F4F',
  },
  emptyHint: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.textMuted,
    paddingVertical: 12,
  },
})
