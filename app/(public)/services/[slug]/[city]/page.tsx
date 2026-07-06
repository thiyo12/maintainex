import { prisma } from '@/lib/prisma'
import { REGIONS } from '@/lib/regions'
import { serviceSchema, breadcrumbSchema, localBusinessSchema, faqSchema } from '@/lib/seo'
import { getServiceFaqs } from '@/lib/faq'
import { getCityBySlug, slugifyCity } from '@/lib/cities'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ServiceDetailClient from '../ServiceDetailClient'

function getRegionFromRequest(): 'LK' | 'CA' {
  const headersList = headers()
  const host = headersList.get('host') || ''
  return host.includes('ca.') ? 'CA' : 'LK'
}

function getHostname(): string {
  const headersList = headers()
  return headersList.get('host') || 'maintainex.lk'
}

export const dynamic = 'force-dynamic'

const DEFAULT_REGION = 'LK' as const

export async function generateMetadata({ params }: { params: { slug: string; city: string } }): Promise<Metadata> {
  try {
    const regionKey = DEFAULT_REGION
    const c = REGIONS[regionKey].countryName
    const isCA = regionKey === 'CA'
    const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

    const cityName = getCityBySlug(params.city, regionKey)
    if (!cityName) return { title: 'City Not Found' }

    const service = await prisma.service.findFirst({
      where: { slug: params.slug, isActive: true },
      include: { category: true }
    })
    if (!service) return { title: 'Service Not Found' }

    const title = `${service.name} in ${cityName}, ${c} | Maintainex ${c}`
    const description = `Book professional ${service.name.toLowerCase()} in ${cityName}, ${c}. Trusted ${service.category?.name?.toLowerCase() || 'home service'} providers. Free quotes & same-day service in ${cityName}.`
    const canonicalPath = `/services/${service.slug}/${params.city}`

    return {
      title: `${service.name} in ${cityName}`,
      description,
      keywords: `${service.name} ${cityName}, ${service.name} in ${cityName}, ${service.category?.name} ${cityName}, ${cityName} ${c}`,
      alternates: {
        canonical: `${baseUrl}${canonicalPath}`,
      },
      openGraph: {
        title,
        description,
        url: `${baseUrl}${canonicalPath}`,
        images: service.image ? [{ url: service.image, width: 1200, height: 630 }] : undefined,
      },
    }
  } catch (error) {
    console.error('Error generating metadata for city service:', params.slug, params.city, error)
    return { title: 'Service Details | Maintainex' }
  }
}

async function fetchService(slug: string) {
  try {
    return await prisma.service.findFirst({
      where: { slug, isActive: true },
      include: {
        category: true,
        reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } },
      }
    })
  } catch (error) {
    console.error('Error fetching service:', slug, error)
    return null
  }
}

async function fetchRelatedServices(categoryId: string, excludeId: string) {
  try {
    return await prisma.service.findMany({
      where: {
        categoryId,
        id: { not: excludeId },
        isActive: true,
      },
      take: 4,
      orderBy: { views: 'desc' },
      include: { category: true },
    })
  } catch (error) {
    console.error('Error fetching related services:', error)
    return []
  }
}

export default async function CityServicePage({ params }: { params: { slug: string; city: string } }) {
  try {
    const regionKey = getRegionFromRequest()
    const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

    const cityName = getCityBySlug(params.city, regionKey)
    if (!cityName) notFound()

    const service = await fetchService(params.slug)
    if (!service) {
      return <ServiceDetailClient service={null} relatedServices={[]} region={regionKey} />
    }

    const serialized = {
      ...service,
      price: service.price ? Number(service.price) : null,
      reviews: service.reviews.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    }

    const relatedServices = await fetchRelatedServices(service.categoryId, service.id)

    const avgRating = service.reviews.length > 0
      ? service.reviews.reduce((s, r) => s + r.rating, 0) / service.reviews.length
      : 0

    const serviceJson = serviceSchema({
      name: service.name,
      description: service.description,
      price: service.price,
      image: service.image,
      category: service.category.name,
      slug: service.slug || service.id,
      region: regionKey,
      aggregateRating: service.reviews.length > 0
        ? { ratingValue: avgRating, reviewCount: service.reviews.length }
        : null,
    })

    const breadcrumbJson = breadcrumbSchema([
      { name: 'Home', url: baseUrl },
      { name: 'Services', url: `${baseUrl}/services` },
      { name: service.name, url: `${baseUrl}/services/${service.slug}` },
      { name: cityName, url: `${baseUrl}/services/${service.slug}/${params.city}` },
    ])

    const localBusinessJson = localBusinessSchema(regionKey, cityName)
    const faqs = getServiceFaqs(service.name, regionKey, cityName, service.category?.name)
    const faqJson = faqSchema(faqs)

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }} />
        <ServiceDetailClient service={serialized} relatedServices={relatedServices} region={regionKey} city={cityName} citySlug={params.city} faqs={faqs} />
      </>
    )
  } catch (error) {
    console.error('Error rendering city service page:', params.slug, params.city, error)
    return <ServiceDetailClient service={null} relatedServices={[]} region="LK" />
  }
}
