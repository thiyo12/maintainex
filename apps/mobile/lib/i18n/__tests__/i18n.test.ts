import { describe, expect, it, beforeEach } from 'vitest'
import i18next, { t } from 'i18next'
import { initI18n } from '../index'

describe('i18n', () => {
  beforeEach(async () => {
    await initI18n()
  })

  it('initializes with English as default', () => {
    expect(i18next.language).toBe('en')
  })

  it('returns English string for postJob.header', () => {
    expect(t('postJob.header')).toBe('Post a Job')
  })

  it('returns English string for auth.login.title', () => {
    expect(t('auth.login.title')).toBe('Welcome Back')
  })

  it('returns English string for common.loading', () => {
    expect(t('common.loading')).toBe('Loading...')
  })

  it('returns English string for common.error', () => {
    expect(t('common.error')).toBe('Error')
  })

  it('returns Tamil string when language switched to ta', async () => {
    await i18next.changeLanguage('ta')
    expect(t('postJob.header')).toBe('வேலை இடுக')
    expect(t('auth.login.title')).toBe('மீண்டும் வரவேற்கிறோம்')
  })

  it('returns Sinhala string when language switched to si', async () => {
    await i18next.changeLanguage('si')
    expect(t('postJob.header')).toBe('රැකියාවක් පළ කරන්න')
    expect(t('auth.login.title')).toBe('නැවත සාදරයෙන් පිළිගනිමු')
  })

  it('isolates language switches (en -> ta -> en)', async () => {
    await i18next.changeLanguage('ta')
    expect(t('postJob.header')).toBe('வேலை இடுக')
    await i18next.changeLanguage('en')
    expect(t('postJob.header')).toBe('Post a Job')
  })
})
