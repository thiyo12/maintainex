import { prisma } from '@/lib/prisma'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import { serviceSchema, breadcrumbSchema, localBusinessSchema, faqSchema } from '@/lib/seo'
import { getServiceFaqs } from '@/lib/faq'
import { getCityBySlug } from '@/lib/cities'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ServiceDetailClient from '../ServiceDetailClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string; city: string } }): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
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
  const description = `Professional ${service.name.toLowerCase()} in ${cityName}, ${c}. Book trusted ${service.category?.name?.toLowerCase()} near you in ${cityName}.`
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
}

export default async function CityServicePage({ params }: { params: { slug: string; city: string } }) {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  const cityName = getCityBySlug(params.city, regionKey)
  if (!cityName) notFound()

  const service = await prisma.service.findFirst({
    where: { slug: params.slug, isActive: true },
    include: {
      category: true,
      reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } },
    }
  })

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

  const relatedServices = await prisma.service.findMany({
    where: {
      categoryId: service.categoryId,
      id: { not: service.id },
      isActive: true,
    },
    take: 4,
    orderBy: { views: 'desc' },
    include: { category: true },
  })

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
}
