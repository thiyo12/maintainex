import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import i18next, { changeLanguage } from '../../lib/i18n'
import { colors } from '../../lib/colors'
import { fonts } from '../../lib/fonts'

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ta', name: 'தமிழ்', flag: '🇱🇰' },
  { code: 'si', name: 'සිංහල', flag: '🇱🇰' },
]

export default function LanguageSelector({ style }: { style?: any }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  const current = languages.find(l => l.code === i18next.language) || languages[0]

  const select = async (code: string) => {
    await changeLanguage(code)
    await AsyncStorage.setItem('app-language', code)
    setVisible(false)
  }

  return (
    <>
      <TouchableOpacity style={[styles.trigger, style]} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={styles.triggerText}>{current.flag} {current.name}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('language.select')}</Text>
            {languages.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[styles.option, l.code === i18next.language && styles.optionSelected]}
                onPress={() => select(l.code)}
              >
                <Text style={styles.optionFlag}>{l.flag}</Text>
                <Text style={[styles.optionName, l.code === i18next.language && styles.optionNameSelected]}>
                  {l.name}
                </Text>
                {l.code === i18next.language && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  triggerText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.ink, marginBottom: 16, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4 },
  optionSelected: { backgroundColor: colors.amberBg },
  optionFlag: { fontSize: 24, marginRight: 12 },
  optionName: { fontSize: 16, fontFamily: fonts.body, color: colors.ink, flex: 1 },
  optionNameSelected: { fontFamily: fonts.bodyMedium, color: colors.amberDark },
  checkmark: { fontSize: 18, color: colors.amberDark, fontFamily: fonts.bodyMedium },
})
