import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const LOCATION_DATA = [
  {
    countryCode: 'LK',
    districts: [
      { district: 'Western Province', cities: ['Colombo', 'Dehiwala-Mount Lavinia', 'Moratuwa', 'Sri Jayawardenepura Kotte', 'Kaduwela', 'Kotte', 'Avissawella', 'Homagama'] },
      { district: 'Central Province', cities: ['Kandy', 'Matale', 'Nuwara Eliya'] },
      { district: 'Southern Province', cities: ['Galle', 'Matara', 'Hambantota'] },
      { district: 'Northern Province', cities: ['Jaffna', 'Kilinochchi', 'Mullaitivu', 'Vavuniya', 'Mannar'] },
      { district: 'Eastern Province', cities: ['Trincomalee', 'Batticaloa', 'Ampara'] },
      { district: 'North Western Province', cities: ['Kurunegala', 'Chilaw', 'Negombo'] },
      { district: 'North Central Province', cities: ['Anuradhapura', 'Polonnaruwa'] },
      { district: 'Uva Province', cities: ['Badulla', 'Monaragala'] },
      { district: 'Sabaragamuwa Province', cities: ['Ratnapura', 'Kegalle'] },
    ],
  },
  {
    countryCode: 'CA',
    districts: [
      { district: 'Ontario', cities: ['Toronto', 'Mississauga', 'Brampton', 'Markham', 'Richmond Hill', 'Vaughan', 'Oakville', 'Burlington', 'Ajax', 'Oshawa'] },
      { district: 'British Columbia', cities: ['Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Coquitlam'] },
      { district: 'Quebec', cities: ['Montreal', 'Quebec City', 'Laval'] },
      { district: 'Alberta', cities: ['Calgary', 'Edmonton'] },
    ],
  },
]

async function seedLocations() {
  let created = 0
  for (const country of LOCATION_DATA) {
    for (const district of country.districts) {
      for (const city of district.cities) {
        const exists = await prisma.propertyLocation.findFirst({
          where: { countryCode: country.countryCode, district: district.district, city },
        })
        if (!exists) {
          await prisma.propertyLocation.create({
            data: { countryCode: country.countryCode, district: district.district, city, isActive: true },
          })
          created++
        }
      }
    }
  }
  return created
}

const listings = [
  // SRI LANKA
  {
    postedBy: 'system',
    title: '3-Bedroom House in Colombo 5',
    description: 'Beautiful modern house with garden, near Colombo 5. Fully furnished with AC, washing machine, and modern kitchen. Quiet neighborhood close to schools and hospitals.',
    type: 'sale',
    propertyType: 'house',
    purpose: 'sale',
    priceLkr: 65000000,
    countryCode: 'LK',
    district: 'Western Province',
    city: 'Colombo',
    address: 'Bauddhaloka Mawatha, Colombo 05',
    bedrooms: 3,
    bathrooms: 2,
    areaSqft: 1800,
    parking: 2,
    isFurnished: true,
    isNewProperty: true,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800']),
    amenities: JSON.stringify(['Garden', 'Parking', 'AC', 'Furnished', 'Security']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: '2-Bedroom Apartment for Rent in Kandy',
    description: 'Spacious apartment in the heart of Kandy with mountain views. Walking distance to Kandy Lake and Temple of the Tooth.',
    type: 'rent',
    propertyType: 'apartment',
    purpose: 'rent',
    priceLkr: 85000,
    pricePer: 'month',
    countryCode: 'LK',
    district: 'Central Province',
    city: 'Kandy',
    address: 'Peradeniya Road, Kandy',
    bedrooms: 2,
    bathrooms: 1,
    areaSqft: 950,
    parking: 1,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800']),
    amenities: JSON.stringify(['Parking', 'Water Tank', 'Security']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: 'Commercial Office Space in Galle',
    description: 'Prime commercial space on Galle Road, ideal for retail or office use. High foot traffic area, near Galle Fort.',
    type: 'commercial',
    propertyType: 'commercial',
    purpose: 'commercial',
    priceLkr: 150000,
    pricePer: 'month',
    countryCode: 'LK',
    district: 'Southern Province',
    city: 'Galle',
    address: 'Galle Road, Galle',
    areaSqft: 1200,
    parking: 3,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800']),
    amenities: JSON.stringify(['3-Phase Power', 'Parking', 'Central Location']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: 'Luxury Villa in Negombo',
    description: 'Beachfront villa with private pool, 4 bedrooms, and direct beach access. Modern design with ocean views.',
    type: 'sale',
    propertyType: 'house',
    purpose: 'sale',
    priceLkr: 120000000,
    countryCode: 'LK',
    district: 'Western Province',
    city: 'Negombo',
    address: 'Lewis Place, Negombo',
    bedrooms: 4,
    bathrooms: 3,
    areaSqft: 3200,
    parking: 3,
    isFurnished: true,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800']),
    amenities: JSON.stringify(['Pool', 'Beach Access', 'Garden', 'Parking', 'AC', 'Furnished']),
    status: 'approved',
    isFeatured: true,
  },
  {
    postedBy: 'system',
    title: 'Land for Sale in Matara',
    description: '40-perch land plot in Matara, ideal for residential development. Clear deed, road access, and electricity available.',
    type: 'land',
    propertyType: 'land',
    purpose: 'land',
    priceLkr: 12000000,
    countryCode: 'LK',
    district: 'Southern Province',
    city: 'Matara',
    address: 'Wirawila, Matara',
    landSize: 12000,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800']),
    amenities: JSON.stringify(['Road Access', 'Electricity', 'Clear Deed']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: '1-Bedroom Studio in Colombo 7',
    description: 'Compact modern studio apartment in Cinnamon Gardens. Ideal for young professionals. Close to universities.',
    type: 'rent',
    propertyType: 'apartment',
    purpose: 'rent',
    priceLkr: 55000,
    pricePer: 'month',
    countryCode: 'LK',
    district: 'Western Province',
    city: 'Colombo',
    address: 'Barnes Place, Colombo 07',
    bedrooms: 1,
    bathrooms: 1,
    areaSqft: 450,
    parking: 1,
    isFurnished: true,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800']),
    amenities: JSON.stringify(['Gym', 'Security', 'WiFi', 'Furnished']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: 'Family Home in Kurunegala',
    description: 'Spacious 3-bedroom home in a peaceful Kurunegala suburb. Large garden with mature fruit trees.',
    type: 'sale',
    propertyType: 'house',
    purpose: 'sale',
    priceLkr: 28000000,
    countryCode: 'LK',
    district: 'North Western Province',
    city: 'Kurunegala',
    address: 'Temple Road, Kurunegala',
    bedrooms: 3,
    bathrooms: 2,
    areaSqft: 1500,
    parking: 2,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800']),
    amenities: JSON.stringify(['Garden', 'Parking', 'Water Tank']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: 'Retail Space in Jaffna',
    description: 'Prime retail space on Main Street, Jaffna. High visibility location, suitable for shops or restaurants.',
    type: 'commercial',
    propertyType: 'commercial',
    purpose: 'commercial',
    priceLkr: 120000,
    pricePer: 'month',
    countryCode: 'LK',
    district: 'Northern Province',
    city: 'Jaffna',
    address: 'Main Street, Jaffna',
    areaSqft: 800,
    parking: 2,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800']),
    amenities: JSON.stringify(['Renovated', 'High Traffic', 'Parking Nearby']),
    status: 'approved',
  },
  // CANADA
  {
    postedBy: 'system',
    title: 'Modern Condo in Downtown Toronto',
    description: 'Stunning 2-bedroom condo in the heart of downtown Toronto. Floor-to-ceiling windows, modern kitchen, and city skyline views. Walking distance to TTC subway.',
    type: 'sale',
    propertyType: 'apartment',
    purpose: 'sale',
    priceLkr: 650000,
    countryCode: 'CA',
    district: 'Ontario',
    city: 'Toronto',
    address: '123 King Street West, Toronto, ON M5X 1E1',
    bedrooms: 2,
    bathrooms: 2,
    areaSqft: 850,
    parking: 1,
    isFurnished: false,
    isNewProperty: true,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800']),
    amenities: JSON.stringify(['Gym', 'Concierge', 'Rooftop Terrace', 'Party Room', 'Bike Storage']),
    status: 'approved',
    isFeatured: true,
  },
  {
    postedBy: 'system',
    title: 'Townhouse in Mississauga',
    description: 'Beautiful 3-bedroom townhouse in Erin Mills. Finished basement, private garage, and close to schools and shopping.',
    type: 'sale',
    propertyType: 'house',
    purpose: 'sale',
    priceLkr: 890000,
    countryCode: 'CA',
    district: 'Ontario',
    city: 'Mississauga',
    address: '456 Erin Mills Parkway, Mississauga, ON L5M 1A1',
    bedrooms: 3,
    bathrooms: 3,
    areaSqft: 1800,
    parking: 2,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800']),
    amenities: JSON.stringify(['Garage', 'Basement', 'Patio', 'Near Schools']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: 'Apartment for Rent in Brampton',
    description: 'Bright and spacious 1-bedroom apartment near Bramalea City Centre. Includes parking and in-suite laundry.',
    type: 'rent',
    propertyType: 'apartment',
    purpose: 'rent',
    priceLkr: 2200,
    pricePer: 'month',
    countryCode: 'CA',
    district: 'Ontario',
    city: 'Brampton',
    address: '789 Queen Street East, Brampton, ON L6V 1A1',
    bedrooms: 1,
    bathrooms: 1,
    areaSqft: 650,
    parking: 1,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800']),
    amenities: JSON.stringify(['Laundry', 'Parking', 'Pet Friendly', 'Near Transit']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: 'Executive Home in Markham',
    description: 'Luxurious 4-bedroom detached home in Unionville. Hardwood floors, chef kitchen, and professionally landscaped yard.',
    type: 'sale',
    propertyType: 'house',
    purpose: 'sale',
    priceLkr: 1450000,
    countryCode: 'CA',
    district: 'Ontario',
    city: 'Markham',
    address: '321 Main Street Unionville, Markham, ON L3R 2G5',
    bedrooms: 4,
    bathrooms: 4,
    areaSqft: 3200,
    parking: 3,
    isFurnished: false,
    isNewProperty: true,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800']),
    amenities: JSON.stringify(['Hardwood Floors', 'Chef Kitchen', 'Landscaped Yard', 'Central AC']),
    status: 'approved',
  },
  {
    postedBy: 'system',
    title: 'Commercial Space in Vaughan',
    description: 'Prime retail/commercial space near Vaughan Mills. High traffic location with excellent visibility from Highway 400.',
    type: 'commercial',
    propertyType: 'commercial',
    purpose: 'commercial',
    priceLkr: 5500,
    pricePer: 'month',
    countryCode: 'CA',
    district: 'Ontario',
    city: 'Vaughan',
    address: '600 Highway 7, Vaughan, ON L4K 4V8',
    areaSqft: 2000,
    parking: 10,
    isFurnished: false,
    contactPhone: '0000000000',
    contactName: 'Demo Contact',
    photos: JSON.stringify(['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800']),
    amenities: JSON.stringify(['Highway Access', 'Parking Lot', 'High Visibility', 'Loading Dock']),
    status: 'approved',
  },
]

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    // Seed locations first
    const locationsSeeded = await seedLocations()

    const existing = await prisma.realEstateListing.count()
    if (existing >= listings.length) {
      return NextResponse.json({ message: 'Listings already seeded', count: existing, locations: locationsSeeded })
    }

    let created = 0
    for (const data of listings) {
      const exists = await prisma.realEstateListing.findFirst({
        where: { title: data.title },
      })
      if (!exists) {
        await prisma.realEstateListing.create({ data: data as any })
        created++
      }
    }

    return NextResponse.json({ message: `Seeded ${created} listings`, total: existing + created, locations: locationsSeeded })
  } catch (error: any) {
    secureConsole.error('Seed error:', error)
    return NextResponse.json({ error: error?.message || 'Seed failed' }, { status: 500 })
  }
}
