import 'react-i18next'
import en from '../lib/i18n/locales/en'

type Resources = typeof en

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: Resources
  }
}
