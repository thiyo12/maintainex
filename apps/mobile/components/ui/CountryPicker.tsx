import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native'
import { CaretDown, Check } from 'phosphor-react-native'

export interface Country {
  code: string
  name: string
  dial: string
  flag: string
}

export const COUNTRIES: Country[] = [
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
]

interface Props {
  selected: Country
  onChange: (country: Country) => void
}

export default function CountryPicker({ selected, onChange }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)}>
        <Text style={styles.flag}>{selected.flag}</Text>
        <Text style={styles.dial}>{selected.dial}</Text>
        <CaretDown size={14} color="#B3B3B3" weight="bold" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select country</Text>
            {COUNTRIES.map((country) => (
              <TouchableOpacity
                key={country.code}
                style={[styles.option, country.code === selected.code && styles.optionSelected]}
                onPress={() => { onChange(country); setVisible(false) }}
              >
                <Text style={styles.optionFlag}>{country.flag}</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionName}>{country.name}</Text>
                  <Text style={styles.optionDial}>{country.dial}</Text>
                </View>
                {country.code === selected.code && (
                  <Check size={20} color="#F5A623" weight="fill" />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
    borderRightWidth: 1, borderRightColor: '#2E2E2E',
  },
  flag: { fontSize: 20 },
  dial: { fontSize: 15, fontFamily: 'Outfit_500Medium', color: '#FFFFFF' },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  sheet: {
    width: '100%', backgroundColor: '#1C1C1C', borderRadius: 20,
    padding: 20, gap: 4,
  },
  sheetTitle: {
    fontSize: 17, fontFamily: 'Outfit_700Bold', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 12,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
  },
  optionSelected: { backgroundColor: 'rgba(245,166,35,0.12)' },
  optionFlag: { fontSize: 28 },
  optionText: { flex: 1 },
  optionName: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: '#FFFFFF' },
  optionDial: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: '#B3B3B3' },
})
