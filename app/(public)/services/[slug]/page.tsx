import { prisma } from '@/lib/prisma'
import { getRegionFromHost, REGIONS } from '@/lib/regions'
import { serializeStructuredData, serviceSchema, breadcrumbSchema, faqSchema } from '@/lib/seo'
import { getServiceFaqs } from '@/lib/faq'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import ServiceDetailClient from './ServiceDetailClient'

async function getRegionFromRequest(): Promise<'LK' | 'CA'> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  return getRegionFromHost(host) === 'CA' ? 'CA' : 'LK'
}

async function getHostname(): Promise<string> {
  const headersList = await headers()
  return headersList.get('host') || 'maintainex.lk'
}

export const dynamic = 'force-dynamic'

const DEFAULT_REGION: 'LK' | 'CA' = 'LK'
const DEFAULT_HOST = 'maintainex.lk'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params
    const regionKey = await getRegionFromRequest()
    const host = DEFAULT_HOST
    const c = REGIONS[regionKey].countryName
    const isCA = regionKey === 'CA'
    const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

    const service = await prisma.service.findFirst({
      where: { slug, isActive: true, countryCode: regionKey },
      include: { category: true }
    })
    if (!service) return { title: 'Service Not Found' }

    const priceStr = service.price
      ? isCA
        ? `From $${Number(service.price).toLocaleString()}`
        : `From LKR ${Number(service.price).toLocaleString()}`
      : ''
    const catName = service.category?.name?.toLowerCase().replace(/ & /g, ' & ') || 'home'

    const title = isCA
      ? `${service.name} in Vancouver, Canada | ${catName} Service | ${priceStr} | Maintainex`
      : `${service.name} in Sri Lanka | ${catName} Service | ${priceStr} | Maintainex`

    const description = isCA
      ? `Professional ${service.name.toLowerCase()} in Vancouver, Canada. Trusted ${catName} providers. Free quotes, vetted professionals. ${priceStr}. Book online.`
      : `Book professional ${service.name.toLowerCase()} in Jaffna, Colombo, Kandy & Galle. Trusted ${catName} providers. Free quotes in minutes. ${priceStr}. Book on Maintainex.`

    return {
      title,
      description,
      keywords: `${service.name}, ${service.name} ${c}, ${service.category?.name} ${c}, ${catName} ${c}, ${catName} service, book ${service.name.toLowerCase()} online`,
      alternates: {
        canonical: `${baseUrl}/services/${service.slug}`,
      },
      openGraph: {
        title,
        description,
        url: `${baseUrl}/services/${service.slug}`,
        images: service.image ? [{ url: service.image, width: 1200, height: 630 }] : undefined,
      },
    }
  } catch (error) {
    console.error('Error generating metadata for service:', error)
    return { title: 'Service Details | Maintainex' }
  }
}

async function fetchService(slug: string, countryCode: 'LK' | 'CA') {
  try {
    const service = await prisma.service.findFirst({
      where: { slug, isActive: true, countryCode },
      include: {
        category: true,
        reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' },
          select: { id: true, rating: true, comment: true, customerName: true, createdAt: true } },
      }
    })
    return service
  } catch (error) {
    console.error('Error fetching service:', slug, error)
    return null
  }
}

async function fetchRelatedServices(categoryId: string, excludeId: string, countryCode: 'LK' | 'CA') {
  try {
    return await prisma.service.findMany({
      where: {
        categoryId,
        countryCode,
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

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const regionKey = await getRegionFromRequest()
    const host = await getHostname()
    const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

    const service = await fetchService(slug, regionKey)
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

    const relatedServices = await fetchRelatedServices(service.categoryId, service.id, regionKey)

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
    ])

    const faqs = getServiceFaqs(service.name, regionKey, undefined, service.category?.name)
    const faqJson = faqSchema(faqs)

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(serviceJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(breadcrumbJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(faqJson) }} />
        <ServiceDetailClient service={serialized} relatedServices={relatedServices} region={regionKey} faqs={faqs} />
      </>
    )
  } catch (error) {
    console.error('Error rendering service detail page:', error)
    return <ServiceDetailClient service={null} relatedServices={[]} region="LK" />
  }
}
