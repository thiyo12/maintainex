import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import i18next, { changeLanguage } from '../../lib/i18n'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing, borderRadius, shadows } from '../../lib/tokens'

const languages = [
  { code: 'en', name: 'English', flag: 'GB' },
  { code: 'ta', name: 'தமிழ்', flag: 'LK' },
  { code: 'si', name: 'සිංහල', flag: 'LK' },
]

const flagEmojis: Record<string, string> = {
  GB: '🇬🇧',
  LK: '🇱🇰',
}

export default function LanguageSelector({ style }: { style?: any }) {
  const { t } = useTranslation()
  const colors = useColors()
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
        style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, { color: colors.ink }]}>
          {flagEmojis[current.flag]} {current.name}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={[styles.overlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('language.select')}</Text>
            {languages.map(l => {
              const isSelected = l.code === i18next.language
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.option, isSelected && { backgroundColor: colors.accentBg }]}
                  onPress={() => select(l.code)}
                >
                  <Text style={styles.optionFlag}>{flagEmojis[l.flag]}</Text>
                  <Text style={[styles.optionName, { color: colors.ink }, isSelected && { color: colors.accentDark }]}>
                    {l.name}
                  </Text>
                  {isSelected ? (
                    <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>
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

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1 },
  triggerText: { fontSize: fontSizes.bodySmall, fontFamily: fonts.bodyMedium },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.xxl, paddingBottom: spacing.xxxxl },
  sheetTitle: { fontSize: fontSizes.h3, fontFamily: fonts.headingBold, marginBottom: spacing.lg, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, marginBottom: spacing.xs },
  optionFlag: { fontSize: 24, marginRight: spacing.md },
  optionName: { fontSize: fontSizes.body, fontFamily: fonts.body, flex: 1 },
  checkmark: { fontSize: 18, fontFamily: fonts.bodyMedium },
})
