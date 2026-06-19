import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import i18next, { changeLanguage } from '../../lib/i18n'
import { useTheme } from '../../lib/ThemeContext'

const languages = [
  { code: 'en', name: 'English', flag: 'GB' },
  { code: 'ta', name: 'தமிழ்', flag: 'LK' },
  { code: 'si', name: 'සිංහල', flag: 'LK' },
]

export default function LanguageSelector({ style }: { style?: any }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [visible, setVisible] = useState(false)

  const current = languages.find(l => l.code === i18next.language) || languages[0]

  const select = async (code: string) => {
    await changeLanguage(code)
    await AsyncStorage.setItem('app-language', code)
    setVisible(false)
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.white, borderColor: colors.border }, style]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, { color: colors.ink }]}>
          {current.name}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.white }]}>
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('language.select')}</Text>
            {languages.map(l => {
              const isSelected = l.code === i18next.language
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.option, isSelected && { backgroundColor: colors.amberBg }]}
                  onPress={() => select(l.code)}
                >
                  <Text style={[styles.optionName, { color: colors.ink }, isSelected && styles.optionNameSelected]}>
                    {l.name}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={16} color={colors.amberDark} />
                  ) : null}
                </TouchableOpacity>
              )
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border, gap: 6,
  },
  triggerText:        { fontSize: 14, fontFamily: 'Outfit_700Bold', color: colors.ink },
  overlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:              { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  sheetTitle:         { fontSize: 18, fontFamily: 'Outfit_900Black', marginBottom: 20, textAlign: 'center', letterSpacing: -0.3 },
  option:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 6 },
  optionName:         { fontSize: 16, fontFamily: 'Outfit_500Medium', flex: 1 },
  optionNameSelected: { fontFamily: 'Outfit_700Bold', color: colors.amberDark },
})
