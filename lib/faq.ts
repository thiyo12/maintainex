export interface FaqItem {
  question: string
  answer: string
}

export function getServiceFaqs(
  serviceName: string,
  region: string,
  city?: string,
  categoryName?: string
): FaqItem[] {
  const cat = categoryName?.toLowerCase() || 'home service'
  const isCA = region === 'CA'
  const country = isCA ? 'Canada' : 'Sri Lanka'
  const phone = isCA ? '+1 (416) 427-9518' : '+94 77 086 7609'
  const currency = isCA ? 'CAD' : 'LKR'

  return [
    {
      question: `What ${serviceName} services does Maintainex offer${city ? ` in ${city}` : ''}?`,
      answer: `Maintainex provides professional ${serviceName.toLowerCase()} services${city ? ` in ${city} and surrounding areas, ${country}` : ` across ${country}`}. Our services include comprehensive ${cat} solutions tailored to your needs, performed by trained and verified professionals. We cover residential and commercial properties with flexible scheduling options.`
    },
    {
      question: `How much does ${serviceName} cost${city ? ` in ${city}` : ''}?`,
      answer: `The cost of ${serviceName.toLowerCase()} in ${currency} depends on the scope of work, property size, and specific requirements. Contact Maintainex at ${phone} for a free, no-obligation quote${city ? ` for ${city} areas` : ''}. We offer competitive pricing with no hidden fees and full transparency on all charges.`
    },
    {
      question: `How do I book ${serviceName}${city ? ` in ${city}` : ''} with Maintainex?`,
      answer: `Booking ${serviceName.toLowerCase()} with Maintainex is easy. You can book online at ${isCA ? 'ca.maintainex.lk' : 'maintainex.lk'}/booking, call ${phone}, or send a WhatsApp message. Simply select your service, choose your preferred date and time, and we'll send a professional to your location${city ? ` in ${city}` : ''}.`
    },
    {
      question: `Are Maintainex ${serviceName} professionals trained and verified?`,
      answer: `Yes, all Maintainex professionals undergo thorough background checks, training, and verification before joining our team. Each ${serviceName.toLowerCase()} specialist is assessed for skills, reliability, and customer service standards to ensure high-quality results. We take safety and quality seriously.`
    },
    {
      question: `What areas do you serve for ${serviceName}?`,
      answer: city
        ? `Maintainex provides ${serviceName.toLowerCase()} services across ${city} and all surrounding areas in ${country}. We cover both residential and commercial properties within the region. Contact us at ${phone} to check availability in your specific location.`
        : `Maintainex provides ${serviceName.toLowerCase()} services across all major cities and districts in ${country}. We cover both residential and commercial properties. Contact us at ${phone} to check availability in your area.`
    },
    {
      question: `Do I need to provide equipment for ${serviceName}?`,
      answer: `No, you don't need to provide any equipment. Maintainex professionals bring all necessary tools, equipment, and supplies for ${serviceName.toLowerCase()}. We use professional-grade equipment and eco-friendly products to deliver the best results every time.`
    },
    {
      question: `Can I schedule recurring ${serviceName} services${city ? ` in ${city}` : ''}?`,
      answer: `Yes, Maintainex offers flexible scheduling options including one-time, weekly, bi-weekly, and monthly ${serviceName.toLowerCase()} services${city ? ` in ${city}` : ''}. You can set up a recurring schedule that works for you and modify or cancel anytime with no penalties.`
    },
    {
      question: `What if I'm not satisfied with the ${serviceName} service?`,
      answer: `We stand behind the quality of our ${serviceName.toLowerCase()} services. If you're not satisfied, contact us at ${phone} within 24 hours and we'll make it right. Customer satisfaction is our top priority, and we offer a satisfaction guarantee on all bookings.`
    },
  ]
}

export function getLocalFaqs(region: string): FaqItem[] {
  const isCA = region === 'CA'
  return [
    {
      question: `How does Maintainex work in ${isCA ? 'Canada' : 'Sri Lanka'}?`,
      answer: `Maintainex connects you with verified local professionals for home services. Browse services, book online, and a trained specialist arrives at your location. We handle all the coordination so you don't have to.`
    },
    {
      question: `Is Maintainex available in ${isCA ? 'all Canadian provinces' : 'all Sri Lankan districts'}?`,
      answer: isCA
        ? 'Maintainex currently serves the Greater Toronto Area (GTA) including Toronto, Scarborough, Mississauga, Brampton, Markham, Richmond Hill, Vaughan, and surrounding cities. We are expanding to more areas soon.'
        : 'Maintainex serves all 25 districts of Sri Lanka including Colombo, Kandy, Galle, Jaffna, Negombo, Kurunegala, and more. Check our service page for your city.'
    },
  ]
}
