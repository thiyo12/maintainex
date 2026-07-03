import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'
import { templateJobs } from '../../lib/api'
import { fonts } from '../../lib/fonts'

interface Suggestion {
  id: string
  name: string
}

interface Props {
  onSelect: (jobId: string, jobName: string) => void
  placeholder?: string
  minQueryLength?: number
}

export default function SearchSuggestions({ onSelect, placeholder, minQueryLength = 2 }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback(async (q: string) => {
    if (q.length < minQueryLength) {
      setSuggestions([])
      setShowResults(false)
      return
    }
    setLoading(true)
    try {
      const results = await templateJobs.search(q)
      setSuggestions(results.map((r: any) => ({ id: r.id, name: r.name })))
      setShowResults(true)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [minQueryLength])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const handleSelect = (item: Suggestion) => {
    setQuery(item.name)
    setShowResults(false)
    onSelect(item.id, item.name)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrap, { backgroundColor: colors.white, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.ink }]}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder || t('home.searchServices')}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={colors.amber} />}
      </View>
      {showResults && suggestions.length > 0 && (
        <View style={[styles.results, { backgroundColor: colors.white, borderColor: colors.border }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultItem, { borderBottomColor: colors.border }]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.resultText, { color: colors.ink }]}>{item.name}</Text>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    zIndex: 100,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts?.body || 'Inter_400Regular',
  },
  results: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  resultText: {
    fontSize: 14,
    fontFamily: fonts?.body || 'Inter_400Regular',
  },
})
