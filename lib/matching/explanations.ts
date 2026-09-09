import { ScoreComponents, ProviderType } from './types'

export function buildExplanationReasons(
  components: ScoreComponents,
  providerType: ProviderType,
): string[] {
  const reasons: string[] = []

  if (components.capability >= 80) reasons.push('Strong capability match for this service')
  else if (components.capability >= 50) reasons.push('Moderate capability match')
  else reasons.push('Limited capability match')

  if (components.reliability >= 80) reasons.push('High completion reliability')
  else if (components.reliability >= 50) reasons.push('Average completion reliability')
  else reasons.push('Lower completion reliability')

  if (components.reputation >= 80) reasons.push('Excellent reputation')
  else if (components.reputation >= 50) reasons.push('Good reputation')
  else reasons.push('Building reputation')

  if (components.availability >= 80) reasons.push('Currently available')
  else if (components.availability >= 50) reasons.push('Likely available')
  else reasons.push('Availability uncertain')

  if (components.travel >= 80) reasons.push('Close to job location')
  else if (components.travel >= 50) reasons.push('Within reasonable travel distance')
  else reasons.push('Further from job location')

  if (components.experience >= 60) reasons.push('Relevant experience')
  else if (components.experience >= 30) reasons.push('Some relevant experience')
  else reasons.push('Limited relevant experience')

  if (providerType === 'COMPANY') {
    reasons.push('Company provider with team capacity')
  }

  return reasons
}

export function buildCustomerFacingReasons(
  components: ScoreComponents,
  providerType: ProviderType,
): string[] {
  const reasons: string[] = []

  if (components.capability >= 70) reasons.push('Verified for requested service')
  if (components.availability >= 70) reasons.push('Available at requested time')
  if (components.reliability >= 70) reasons.push('High completion rate')
  if (components.reputation >= 70) reasons.push('Well-rated by customers')
  if (components.travel >= 70) reasons.push('Near your location')

  if (reasons.length === 0) reasons.push('Meets basic requirements')

  return reasons
}
