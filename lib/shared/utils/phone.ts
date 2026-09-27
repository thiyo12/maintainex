export function toE164(phone: string, defaultCountryCode: string = '94'): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) {
    digits = defaultCountryCode + digits.slice(1)
  }
  if (!digits.startsWith(defaultCountryCode) && digits.length <= 10) {
    digits = defaultCountryCode + digits
  }
  return '+' + digits
}

export function getCountryFromPhone(e164Phone: string): string {
  if (e164Phone.startsWith('+94')) return 'LK'
  if (e164Phone.startsWith('+1')) return 'CA'
  return 'LK'
}

export function formatWhatsAppPhone(phone: string, countryCode: string = 'LK'): string {
  let digits = phone.replace(/\D/g, '')
  const prefix = countryCode === 'CA' ? '1' : '94'
  if (digits.startsWith('0')) digits = prefix + digits.slice(1)
  if (!digits.startsWith(prefix)) digits = prefix + digits
  return digits + '@c.us'
}
