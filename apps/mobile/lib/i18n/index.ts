import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import ta from './locales/ta'
import si from './locales/si'

const resources = { en: { translation: en }, ta: { translation: ta }, si: { translation: si } }

let initialized = false

export async function initI18n(language?: string) {
  if (initialized) return
  initialized = true

  await i18next.use(initReactI18next).init({
    resources,
    lng: language || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export function changeLanguage(lng: string) {
  return i18next.changeLanguage(lng)
}

export function getCurrentLanguage() {
  return i18next.language
}

export default i18next
