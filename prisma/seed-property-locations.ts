import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LOCATION_DATA = [
  // SRI LANKA
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
  // CANADA
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

export async function seedPropertyLocations() {
  let created = 0

  for (const country of LOCATION_DATA) {
    for (const district of country.districts) {
      for (const city of district.cities) {
        const exists = await prisma.propertyLocation.findFirst({
          where: {
            countryCode: country.countryCode,
            district: district.district,
            city,
          },
        })

        if (!exists) {
          await prisma.propertyLocation.create({
            data: {
              countryCode: country.countryCode,
              district: district.district,
              city,
              isActive: true,
            },
          })
          created++
        }
      }
    }
  }

  return created
}
