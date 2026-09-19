import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native'
import { CaretDown, Check } from 'phosphor-react-native'

export interface Country {
  code: string
  name: string
  dial: string
  // Kept for backward compatibility with any existing callers/data.
  // The V3.3 mobile selector intentionally does not display flags.
  flag?: string
}

export const COUNTRIES: Country[] = [
  { code: 'LK', name: 'Sri Lanka', dial: '+94' },
  { code: 'CA', name: 'Canada', dial: '+1' },
]

interface Props {
  selected: Country
  onChange: (country: Country) => void
}

export default function CountryPicker({ selected, onChange }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setVisible(true)}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={`Country code ${selected.dial}. Double tap to change country.`}
      >
        <Text style={styles.dial}>{selected.dial}</Text>
        <CaretDown size={13} color="#777777" weight="bold" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Select country</Text>

            {COUNTRIES.map((country) => {
              const active = country.code === selected.code
              return (
                <TouchableOpacity
                  key={country.code}
                  style={[styles.option, active && styles.optionSelected]}
                  onPress={() => {
                    onChange(country)
                    setVisible(false)
                  }}
                  activeOpacity={0.72}
                >
                  <View style={styles.optionText}>
                    <Text style={styles.optionName}>{country.name}</Text>
                    <Text style={styles.optionCode}>{country.code}</Text>
                  </View>
                  <Text style={styles.optionDial}>{country.dial}</Text>
                  {active ? <Check size={18} color="#000000" weight="bold" /> : <View style={styles.checkSpace} />}
                </TouchableOpacity>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    height: '100%',
    minWidth: 76,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: '#E3E3E3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dial: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#111111',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D6D6D6',
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#111111',
    marginBottom: 12,
  },
  option: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7E7E7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#111111',
  },
  optionCode: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    color: '#777777',
  },
  optionDial: {
    marginRight: 12,
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#333333',
  },
  checkSpace: {
    width: 18,
  },
})
