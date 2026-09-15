import { describe, expect, it, beforeEach } from 'vitest'
import { initI18n } from '../index'
import en from '../locales/en'
import ta from '../locales/ta'
import si from '../locales/si'

function flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

describe('Locale key parity', () => {
  beforeEach(async () => {
    await initI18n()
  })

  const enKeys = flattenKeys(en as Record<string, any>)
  const taKeys = flattenKeys(ta as Record<string, any>)
  const siKeys = flattenKeys(si as Record<string, any>)

  it('Tamil has all English keys', () => {
    const missingInTa = enKeys.filter((k) => !taKeys.includes(k))
    expect(missingInTa).toEqual([])
  })

  it('Sinhala has all English keys', () => {
    const missingInSi = enKeys.filter((k) => !siKeys.includes(k))
    expect(missingInSi).toEqual([])
  })

  it('English has no extra keys beyond Tamil', () => {
    const extraInEn = taKeys.filter((k) => !enKeys.includes(k))
    expect(extraInEn).toEqual([])
  })

  it('English has no extra keys beyond Sinhala', () => {
    const extraInEn = siKeys.filter((k) => !enKeys.includes(k))
    expect(extraInEn).toEqual([])
  })

  it('Phase 10.6 readiness keys exist in all locales', () => {
    const readinessKeys = ['readiness.title', 'readiness.subtitle', 'readiness.identity', 'readiness.identityComplete', 'readiness.identityPending', 'readiness.identityMissing', 'readiness.profession', 'readiness.professionComplete', 'readiness.professionMissing', 'readiness.skills', 'readiness.skillsComplete', 'readiness.skillsMissing', 'readiness.serviceArea', 'readiness.serviceAreaComplete', 'readiness.serviceAreaMissing', 'readiness.availability', 'readiness.availabilityComplete', 'readiness.availabilityMissing', 'readiness.ready', 'readiness.notReady', 'readiness.completeSetup', 'readiness.goToIdentity', 'readiness.goToProfession', 'readiness.goToSkills', 'readiness.goToServiceArea', 'readiness.goToAvailability', 'readiness.stepOf', 'readiness.allComplete']
    for (const key of readinessKeys) {
      expect(enKeys).toContain(key)
      expect(taKeys).toContain(key)
      expect(siKeys).toContain(key)
    }
  })

  it('Phase 10.6 serviceArea keys exist in all locales', () => {
    const keys = ['serviceArea.title', 'serviceArea.subtitle', 'serviceArea.currentArea', 'serviceArea.changeArea', 'serviceArea.noAreaSet', 'serviceArea.selectArea', 'serviceArea.save', 'serviceArea.saving', 'serviceArea.saved', 'serviceArea.radius', 'serviceArea.radiusKm', 'serviceArea.locationPermission', 'serviceArea.detectedLocation']
    for (const key of keys) {
      expect(enKeys).toContain(key)
      expect(taKeys).toContain(key)
      expect(siKeys).toContain(key)
    }
  })

  it('Phase 10.6 availabilitySettings keys exist in all locales', () => {
    const keys = ['availabilitySettings.title', 'availabilitySettings.subtitle', 'availabilitySettings.available', 'availabilitySettings.unavailable', 'availabilitySettings.workHours', 'availabilitySettings.workDays', 'availabilitySettings.startTime', 'availabilitySettings.endTime', 'availabilitySettings.save', 'availabilitySettings.saving', 'availabilitySettings.saved', 'availabilitySettings.monday', 'availabilitySettings.tuesday', 'availabilitySettings.wednesday', 'availabilitySettings.thursday', 'availabilitySettings.friday', 'availabilitySettings.saturday', 'availabilitySettings.sunday', 'availabilitySettings.toggleAvailable']
    for (const key of keys) {
      expect(enKeys).toContain(key)
      expect(taKeys).toContain(key)
      expect(siKeys).toContain(key)
    }
  })

  it('Phase 10.6 inspection keys exist in all locales', () => {
    const keys = ['inspection.title', 'inspection.subtitle', 'inspection.findings', 'inspection.findingsPlaceholder', 'inspection.photos', 'inspection.addPhoto', 'inspection.takePhoto', 'inspection.chooseFromLibrary', 'inspection.notes', 'inspection.notesPlaceholder', 'inspection.submit', 'inspection.submitting', 'inspection.submitted', 'inspection.submittedDesc', 'inspection.beforePhotos', 'inspection.afterPhotos', 'inspection.addBeforePhoto', 'inspection.addAfterPhoto', 'inspection.noPhotos', 'inspection.estimatedCost', 'inspection.costPlaceholder', 'inspection.estimatedDuration', 'inspection.durationPlaceholder']
    for (const key of keys) {
      expect(enKeys).toContain(key)
      expect(taKeys).toContain(key)
      expect(siKeys).toContain(key)
    }
  })

  it('Phase 10.6 evidence keys exist in all locales', () => {
    const keys = ['evidence.title', 'evidence.subtitle', 'evidence.photos', 'evidence.documents', 'evidence.addPhoto', 'evidence.addDocument', 'evidence.takePhoto', 'evidence.chooseFromLibrary', 'evidence.notes', 'evidence.notesPlaceholder', 'evidence.submit', 'evidence.submitting', 'evidence.submitted', 'evidence.submittedDesc', 'evidence.photoCount', 'evidence.documentCount', 'evidence.maxSize', 'evidence.supportedFormats']
    for (const key of keys) {
      expect(enKeys).toContain(key)
      expect(taKeys).toContain(key)
      expect(siKeys).toContain(key)
    }
  })

  it('Phase 10.6 changeOrder keys exist in all locales', () => {
    const keys = ['changeOrder.title', 'changeOrder.subtitle', 'changeOrder.reason', 'changeOrder.reasonPlaceholder', 'changeOrder.priceAdjustment', 'changeOrder.priceAdjustmentPlaceholder', 'changeOrder.newPrice', 'changeOrder.currentPrice', 'changeOrder.description', 'changeOrder.descriptionPlaceholder', 'changeOrder.submit', 'changeOrder.submitting', 'changeOrder.submitted', 'changeOrder.submittedDesc', 'changeOrder.approved', 'changeOrder.rejected', 'changeOrder.awaitingApproval', 'changeOrder.reasonRequired']
    for (const key of keys) {
      expect(enKeys).toContain(key)
      expect(taKeys).toContain(key)
      expect(siKeys).toContain(key)
    }
  })

  it('Phase 10.6 jobPin.expired key exists in all locales', () => {
    expect(enKeys).toContain('jobPin.expired')
    expect(taKeys).toContain('jobPin.expired')
    expect(siKeys).toContain('jobPin.expired')
  })
})
