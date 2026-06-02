export function organizationSchema(region: string) {
  const isCA = region === 'CA'
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Maintainex',
    url: isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk',
    logo: 'https://maintainex.lk/favicon.svg',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: isCA ? '+1 416 427 9518' : '+94 77 086 7609',
      contactType: 'customer service',
      areaServed: isCA ? 'CA' : 'LK',
    },
    sameAs: [
      'https://facebook.com/maintainex',
      'https://instagram.com/maintainex',
      'https://wa.me/' + (isCA ? '14164279518' : '94770867609'),
    ],
  }
}

export function localBusinessSchema(region: string, city?: string) {
  const isCA = region === 'CA'
  const areas = isCA
    ? ['Toronto', 'Mississauga', 'Brampton', 'Markham', 'Scarborough', 'North York', 'Etobicoke']
    : ['Colombo', 'Kandy', 'Galle', 'Negombo', 'Jaffna', 'Kurunegala', 'Matara']
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Maintainex',
    description: `Professional cleaning services in ${isCA ? 'Canada' : 'Sri Lanka'}`,
    url: isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk',
    telephone: isCA ? '+1 416 427 9518' : '+94 77 086 7609',
    areaServed: city
      ? { '@type': 'City', name: city }
      : areas.map(a => ({ '@type': 'City', name: a })),
    priceRange: '$$',
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function serviceSchema(service: {
  name: string
  description: string
  price?: number | null
  image?: string | null
  category?: string
  slug: string
  region: string
  aggregateRating?: { ratingValue: number; reviewCount: number } | null
}) {
  const isCA = service.region === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  const obj: any = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Maintainex',
      url: baseUrl,
    },
    url: `${baseUrl}/services/${service.slug}`,
    areaServed: isCA ? 'Canada' : 'Sri Lanka',
  }
  if (service.image) obj.image = service.image
  if (service.price != null) {
    obj.offers = {
      '@type': 'Offer',
      price: service.price,
      priceCurrency: isCA ? 'CAD' : 'LKR',
    }
  }
  if (service.aggregateRating && service.aggregateRating.reviewCount > 0) {
    obj.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: service.aggregateRating.ratingValue,
      reviewCount: service.aggregateRating.reviewCount,
    }
  }
  return obj
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  }
}
