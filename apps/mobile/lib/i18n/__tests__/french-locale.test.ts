import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import i18next, { initI18n } from '../index'
import en from '../locales/en'
import fr from '../locales/fr'

describe('Phase 09 — French mobile language foundation with explicit English fallback', () => {
  beforeAll(async () => {
    await initI18n('en')
  })

  afterEach(async () => {
    await i18next.changeLanguage('en')
  })

  it('registers French and translates basic actions', async () => {
    await i18next.changeLanguage('fr')
    expect(i18next.t('common.save')).toBe('Enregistrer')
    expect(i18next.t('common.cancel')).toBe('Annuler')
    expect(i18next.t('auth.login.title')).toBe('Bon retour')
  })

  it('translates job-status labels used by customer and provider flows', async () => {
    await i18next.changeLanguage('fr')
    expect(i18next.t('jobs.status.inProgress')).toBe('En cours')
    expect(i18next.t('jobs.status.completed')).toBe('Terminé')
    expect(i18next.t('jobs.status.disputed')).toBe('En litige')
  })

  it('retains exact English keys for untranslated features instead of showing missing-key IDs', async () => {
    await i18next.changeLanguage('fr')
    // Full French translation requires separate copy review; the approved
    // English text is the explicit fallback in the interim.
    expect(i18next.t('postJob.step1.title')).toBe(en.postJob.step1.title)
    expect(fr.postJob).not.toHaveProperty('step1')
  })

  it('keeps English, Tamil and Sinhala resources available', async () => {
    expect(i18next.hasResourceBundle('en', 'translation')).toBe(true)
    expect(i18next.hasResourceBundle('ta', 'translation')).toBe(true)
    expect(i18next.hasResourceBundle('si', 'translation')).toBe(true)
    expect(i18next.hasResourceBundle('fr', 'translation')).toBe(true)
  })


  it('does not publish or claim approval of French legal translations', () => {
    expect(fr).not.toHaveProperty('legal')
    expect(fr).not.toHaveProperty('terms')
    expect(fr).not.toHaveProperty('privacy')
  })
})
