import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { ArrowRight, MagnifyingGlass, Plus, X } from 'phosphor-react-native'
import { v2Search } from '../../lib/api-v2'
import { v3 } from '../../theme/v3/tokens'

interface CategoryResult {
  id: string
  name: string
  score?: number
}

interface ServiceResult {
  id: string
  name: string
  categoryId?: string
  categoryName?: string
  score?: number
}

interface Props {
  placeholder?: string
  onCategorySelect: (categoryId: string, categoryName?: string) => void
  onJobSelect: (jobId: string, jobName?: string, categoryId?: string) => void
  onPostJob: (query: string) => void
}

export default function V3DiscoverySearch({ placeholder, onCategorySelect, onJobSelect, onPostJob }: Props) {
  const [value, setValue] = useState('')
  const [categories, setCategories] = useState<CategoryResult[]>([])
  const [services, setServices] = useState<ServiceResult[]>([])
  const [correctedQuery, setCorrectedQuery] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (query: string) => {
    const q = query.trim()
    if (q.length < 2) {
      setCategories([])
      setServices([])
      setCorrectedQuery(undefined)
      return
    }

    setLoading(true)
    try {
      const data = await v2Search.categories(q)
      setCategories((data.categories || []).slice(0, 4))
      setServices((data.subServices || []).slice(0, 5))
      setCorrectedQuery(data.correctedQuery)
    } catch {
      setCategories([])
      setServices([])
      setCorrectedQuery(undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  const change = (text: string) => {
    setValue(text)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(text), 250)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const visible = focused && value.trim().length >= 2

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputShell, focused && styles.inputFocused]}>
        <MagnifyingGlass size={17} color={v3.colors.ink} />
        <TextInput
          value={value}
          onChangeText={change}
          placeholder={placeholder || 'Search services'}
          placeholderTextColor={v3.colors.textMuted}
          style={styles.input}
          returnKeyType="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          onSubmitEditing={() => {
            Keyboard.dismiss()
            if (services[0]) onJobSelect(services[0].id, services[0].name, services[0].categoryId)
            else if (categories[0]) onCategorySelect(categories[0].id, categories[0].name)
            else if (value.trim()) onPostJob(value.trim())
          }}
        />
        {loading ? <ActivityIndicator size="small" color={v3.colors.ink} /> : value ? (
          <TouchableOpacity onPress={() => change('')} hitSlop={10}>
            <X size={15} color={v3.colors.textMuted} weight="bold" />
          </TouchableOpacity>
        ) : null}
      </View>

      {visible ? (
        <View style={styles.dropdown}>
          {correctedQuery ? (
            <TouchableOpacity style={styles.corrected} onPress={() => { change(correctedQuery); search(correctedQuery) }}>
              <Text style={styles.correctedText}>Search for “{correctedQuery}”</Text>
            </TouchableOpacity>
          ) : null}

          {categories.map(item => (
            <TouchableOpacity key={`c-${item.id}`} style={styles.resultRow} onPress={() => onCategorySelect(item.id, item.name)}>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.resultMeta}>Category · choose exact work</Text>
              </View>
              <ArrowRight size={15} color={v3.colors.textMuted} />
            </TouchableOpacity>
          ))}

          {services.map(item => (
            <TouchableOpacity key={`s-${item.id}`} style={styles.resultRow} onPress={() => onJobSelect(item.id, item.name, item.categoryId)}>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.resultMeta} numberOfLines={1}>{item.categoryName || 'Service'} · see nearby providers</Text>
              </View>
              <ArrowRight size={15} color={v3.colors.textMuted} />
            </TouchableOpacity>
          ))}

          {!loading && categories.length === 0 && services.length === 0 ? (
            <Text style={styles.noResult}>No direct match. You can post it as a custom request.</Text>
          ) : null}

          <TouchableOpacity style={styles.customRow} onPress={() => onPostJob(value.trim())}>
            <View style={styles.plusCircle}><Plus size={14} color={v3.colors.paper} weight="bold" /></View>
            <View style={styles.resultCopy}>
              <Text style={styles.customTitle}>Post a custom request</Text>
              <Text style={styles.resultMeta} numberOfLines={1}>“{value.trim()}”</Text>
            </View>
            <ArrowRight size={15} color={v3.colors.ink} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 50 },
  inputShell: {
    height: 52,
    borderRadius: 17,
    backgroundColor: v3.colors.paper,
    borderWidth: 1,
    borderColor: v3.colors.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputFocused: { borderColor: v3.colors.ink },
  input: {
    flex: 1,
    height: 50,
    paddingVertical: 0,
    fontSize: 11.2,
    fontFamily: 'Outfit_600SemiBold',
    color: v3.colors.ink,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 58,
    backgroundColor: v3.colors.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: v3.colors.line,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  corrected: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: v3.colors.amberSoft },
  correctedText: { fontSize: 10.5, fontFamily: 'Outfit_700Bold', color: v3.colors.amberDark },
  resultRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: v3.colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultCopy: { flex: 1 },
  resultTitle: { fontSize: 11.5, fontFamily: 'Outfit_700Bold', color: v3.colors.ink },
  resultMeta: { marginTop: 2, fontSize: 8.8, fontFamily: 'Outfit_500Medium', color: v3.colors.textMuted },
  noResult: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 9.5, fontFamily: 'Outfit_500Medium', color: v3.colors.textSecondary },
  customRow: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  plusCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center' },
  customTitle: { fontSize: 11.5, fontFamily: 'Outfit_800ExtraBold', color: v3.colors.ink },
})
