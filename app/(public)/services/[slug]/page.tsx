import { prisma } from '@/lib/prisma'
import { REGIONS } from '@/lib/regions'
import { serviceSchema, breadcrumbSchema, faqSchema } from '@/lib/seo'
import { getServiceFaqs } from '@/lib/faq'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import ServiceDetailClient from './ServiceDetailClient'

export const revalidate = 3600

export async function generateStaticParams() {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: { slug: true },
    })
    return services.filter(s => s.slug).map(s => ({ slug: s.slug! }))
  } catch (error) {
    console.error('Error in generateStaticParams for services/[slug]:', error)
    return []
  }
}

function getRegionFromRequest(): 'LK' | 'CA' {
  try {
    const headersList = headers()
    const host = headersList.get('host') || ''
    return host.includes('ca.') ? 'CA' : 'LK'
  } catch {
    return 'LK'
  }
}

function getHostname(): string {
  try {
    const headersList = headers()
    return headersList.get('host') || 'maintainex.lk'
  } catch {
    return 'maintainex.lk'
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const regionKey = getRegionFromRequest()
    const host = getHostname()
    const c = REGIONS[regionKey].countryName
    const isCA = regionKey === 'CA'
    const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

    const service = await prisma.service.findFirst({
      where: { slug: params.slug, isActive: true },
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
      ? `${service.name} in Toronto & Canada | ${catName} Service | ${priceStr} | Maintainex`
      : `${service.name} in Sri Lanka | ${catName} Service | ${priceStr} | Maintainex`

    const description = isCA
      ? `Professional ${service.name.toLowerCase()} in Toronto & across Canada. Trusted ${catName} providers. Free quotes, vetted professionals. ${priceStr}. Book online.`
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
    console.error('Error generating metadata for service:', params.slug, error)
    return { title: 'Service Details | Maintainex' }
  }
}

async function fetchService(slug: string) {
  try {
    const service = await prisma.service.findFirst({
      where: { slug, isActive: true },
      include: {
        category: true,
        reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } },
      }
    })
    return service
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

export default async function ServiceDetailPage({ params }: { params: { slug: string } }) {
  try {
    const regionKey = getRegionFromRequest()
    const host = getHostname()
    const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

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
    ])

    const faqs = getServiceFaqs(service.name, regionKey, undefined, service.category?.name)
    const faqJson = faqSchema(faqs)

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }} />
        <ServiceDetailClient service={serialized} relatedServices={relatedServices} region={regionKey} faqs={faqs} />
      </>
    )
  } catch (error) {
    console.error('Error rendering service detail page:', params.slug, error)
    return <ServiceDetailClient service={null} relatedServices={[]} region="LK" />
  }
}
