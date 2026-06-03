export interface LocationArea {
  id: string
  name: string
}

export interface LocationCity {
  id: string
  name: string
  areas: LocationArea[]
}

export interface LocationState {
  id: string
  name: string
  cities: LocationCity[]
}

export interface LocationCountry {
  id: string
  name: string
  code: string
  states: LocationState[]
}

export const LOCATIONS: LocationCountry[] = [
  {
    id: 'lk',
    name: 'Sri Lanka',
    code: 'LK',
    states: [
      {
        id: 'lk-western',
        name: 'Western Province',
        cities: [
          {
            id: 'lk-colombo',
            name: 'Colombo',
            areas: [
              { id: 'lk-colombo-fort', name: 'Fort' },
              { id: 'lk-colombo-borella', name: 'Borella' },
              { id: 'lk-colombo-bambalapitiya', name: 'Bambalapitiya' },
              { id: 'lk-colombo-wellawatte', name: 'Wellawatte' },
              { id: 'lk-colombo-dehiwala', name: 'Dehiwala' },
              { id: 'lk-colombo-mount-lavinia', name: 'Mount Lavinia' },
              { id: 'lk-colombo-nugegoda', name: 'Nugegoda' },
              { id: 'lk-colombo-rajagiriya', name: 'Rajagiriya' },
            ],
          },
          {
            id: 'lk-gampaha',
            name: 'Gampaha',
            areas: [
              { id: 'lk-gampaha-negombo', name: 'Negombo' },
              { id: 'lk-gampaha-jaela', name: 'Ja-Ela' },
              { id: 'lk-gampaha-kadawatha', name: 'Kadawatha' },
              { id: 'lk-gampaha-kiribathgoda', name: 'Kiribathgoda' },
            ],
          },
          {
            id: 'lk-kalutara',
            name: 'Kalutara',
            areas: [
              { id: 'lk-kalutara-panadura', name: 'Panadura' },
              { id: 'lk-kalutara-beruwala', name: 'Beruwala' },
              { id: 'lk-kalutara-aluthgama', name: 'Aluthgama' },
            ],
          },
        ],
      },
      {
        id: 'lk-central',
        name: 'Central Province',
        cities: [
          {
            id: 'lk-kandy',
            name: 'Kandy',
            areas: [
              { id: 'lk-kandy-town', name: 'Kandy Town' },
              { id: 'lk-kandy-peradeniya', name: 'Peradeniya' },
              { id: 'lk-kandy-katugastota', name: 'Katugastota' },
            ],
          },
          {
            id: 'lk-matale',
            name: 'Matale',
            areas: [
              { id: 'lk-matale-dambulla', name: 'Dambulla' },
              { id: 'lk-matale-sigiriya', name: 'Sigiriya' },
            ],
          },
          {
            id: 'lk-nuwaraeliya',
            name: 'Nuwara Eliya',
            areas: [
              { id: 'lk-nuwaraeliya-town', name: 'Nuwara Eliya Town' },
            ],
          },
        ],
      },
      {
        id: 'lk-southern',
        name: 'Southern Province',
        cities: [
          {
            id: 'lk-galle',
            name: 'Galle',
            areas: [
              { id: 'lk-galle-fort', name: 'Galle Fort' },
              { id: 'lk-galle-akmeemana', name: 'Akmeemana' },
            ],
          },
          {
            id: 'lk-matara',
            name: 'Matara',
            areas: [
              { id: 'lk-matara-town', name: 'Matara Town' },
              { id: 'lk-matara-weligama', name: 'Weligama' },
            ],
          },
          {
            id: 'lk-hambantota',
            name: 'Hambantota',
            areas: [
              { id: 'lk-hambantota-tangalle', name: 'Tangalle' },
              { id: 'lk-hambantota-town', name: 'Hambantota Town' },
            ],
          },
        ],
      },
      {
        id: 'lk-northern',
        name: 'Northern Province',
        cities: [
          {
            id: 'lk-jaffna',
            name: 'Jaffna',
            areas: [
              { id: 'lk-jaffna-town', name: 'Jaffna Town' },
              { id: 'lk-jaffna-nallur', name: 'Nallur' },
              { id: 'lk-jaffna-chavakachcheri', name: 'Chavakachcheri' },
            ],
          },
          {
            id: 'lk-kilinochchi',
            name: 'Kilinochchi',
            areas: [
              { id: 'lk-kilinochchi-town', name: 'Kilinochchi Town' },
            ],
          },
          {
            id: 'lk-vavuniya',
            name: 'Vavuniya',
            areas: [
              { id: 'lk-vavuniya-town', name: 'Vavuniya Town' },
            ],
          },
        ],
      },
      {
        id: 'lk-eastern',
        name: 'Eastern Province',
        cities: [
          {
            id: 'lk-trincomalee',
            name: 'Trincomalee',
            areas: [
              { id: 'lk-trincomalee-town', name: 'Trincomalee Town' },
              { id: 'lk-trincomalee-nilaveli', name: 'Nilaveli' },
            ],
          },
          {
            id: 'lk-batticaloa',
            name: 'Batticaloa',
            areas: [
              { id: 'lk-batticaloa-town', name: 'Batticaloa Town' },
            ],
          },
          {
            id: 'lk-ampara',
            name: 'Ampara',
            areas: [
              { id: 'lk-ampara-kalmunai', name: 'Kalmunai' },
            ],
          },
        ],
      },
      {
        id: 'lk-northwestern',
        name: 'North Western Province',
        cities: [
          {
            id: 'lk-kurunegala',
            name: 'Kurunegala',
            areas: [
              { id: 'lk-kurunegala-town', name: 'Kurunegala Town' },
              { id: 'lk-kurunegala-kuliyapitiya', name: 'Kuliyapitiya' },
            ],
          },
          {
            id: 'lk-puttalam',
            name: 'Puttalam',
            areas: [
              { id: 'lk-puttalam-chilaw', name: 'Chilaw' },
            ],
          },
        ],
      },
      {
        id: 'lk-northcentral',
        name: 'North Central Province',
        cities: [
          {
            id: 'lk-anuradhapura',
            name: 'Anuradhapura',
            areas: [
              { id: 'lk-anuradhapura-town', name: 'Anuradhapura Town' },
            ],
          },
          {
            id: 'lk-polonnaruwa',
            name: 'Polonnaruwa',
            areas: [
              { id: 'lk-polonnaruwa-town', name: 'Polonnaruwa Town' },
            ],
          },
        ],
      },
      {
        id: 'lk-ubva',
        name: 'Uva Province',
        cities: [
          {
            id: 'lk-badulla',
            name: 'Badulla',
            areas: [
              { id: 'lk-badulla-town', name: 'Badulla Town' },
              { id: 'lk-badulla-bandarawela', name: 'Bandarawela' },
            ],
          },
          {
            id: 'lk-monaragala',
            name: 'Monaragala',
            areas: [
              { id: 'lk-monaragala-town', name: 'Monaragala Town' },
            ],
          },
        ],
      },
      {
        id: 'lk-sabaragamuwa',
        name: 'Sabaragamuwa Province',
        cities: [
          {
            id: 'lk-ratnapura',
            name: 'Ratnapura',
            areas: [
              { id: 'lk-ratnapura-town', name: 'Ratnapura Town' },
              { id: 'lk-ratnapura-embilipitiya', name: 'Embilipitiya' },
            ],
          },
          {
            id: 'lk-kegalle',
            name: 'Kegalle',
            areas: [
              { id: 'lk-kegalle-town', name: 'Kegalle Town' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'ca',
    name: 'Canada',
    code: 'CA',
    states: [
      {
        id: 'ca-ontario',
        name: 'Ontario',
        cities: [
          {
            id: 'ca-toronto',
            name: 'Toronto',
            areas: [
              { id: 'ca-toronto-downtown', name: 'Downtown' },
              { id: 'ca-toronto-scarborough', name: 'Scarborough' },
              { id: 'ca-toronto-north-york', name: 'North York' },
              { id: 'ca-toronto-etobicoke', name: 'Etobicoke' },
              { id: 'ca-toronto-york', name: 'York' },
              { id: 'ca-toronto-east-york', name: 'East York' },
            ],
          },
          {
            id: 'ca-mississauga',
            name: 'Mississauga',
            areas: [
              { id: 'ca-mississauga-city-centre', name: 'City Centre' },
              { id: 'ca-mississaaga-port-credit', name: 'Port Credit' },
              { id: 'ca-mississauga-streetsville', name: 'Streetsville' },
            ],
          },
          {
            id: 'ca-brampton',
            name: 'Brampton',
            areas: [
              { id: 'ca-brampton-downtown', name: 'Downtown' },
              { id: 'ca-brampton-bramalea', name: 'Bramalea' },
            ],
          },
          {
            id: 'ca-markham',
            name: 'Markham',
            areas: [
              { id: 'ca-markham-unionville', name: 'Unionville' },
              { id: 'ca-markham-thornhill', name: 'Thornhill' },
            ],
          },
          {
            id: 'ca-richmond-hill',
            name: 'Richmond Hill',
            areas: [
              { id: 'ca-richmond-hill-central', name: 'Central' },
            ],
          },
          {
            id: 'ca-vaughan',
            name: 'Vaughan',
            areas: [
              { id: 'ca-vaughan-woodbridge', name: 'Woodbridge' },
              { id: 'ca-vaughan-maple', name: 'Maple' },
            ],
          },
          {
            id: 'ca-oakville',
            name: 'Oakville',
            areas: [
              { id: 'ca-oakville-downtown', name: 'Downtown' },
            ],
          },
          {
            id: 'ca-burlington',
            name: 'Burlington',
            areas: [
              { id: 'ca-burlington-downtown', name: 'Downtown' },
            ],
          },
          {
            id: 'ca-ajax',
            name: 'Ajax',
            areas: [
              { id: 'ca-ajax-central', name: 'Central' },
            ],
          },
          {
            id: 'ca-oshawa',
            name: 'Oshawa',
            areas: [
              { id: 'ca-oshawa-downtown', name: 'Downtown' },
            ],
          },
        ],
      },
    ],
  },
]

export function getCountries(): LocationCountry[] {
  return LOCATIONS
}

export function getCountry(id: string): LocationCountry | undefined {
  return LOCATIONS.find(c => c.id === id)
}

export function getStates(countryId: string): LocationState[] {
  const country = getCountry(countryId)
  return country?.states || []
}

export function getCities(countryId: string, stateId: string): LocationCity[] {
  const state = getStates(countryId).find(s => s.id === stateId)
  return state?.cities || []
}

export function getAreas(countryId: string, stateId: string, cityId: string): LocationArea[] {
  const city = getCities(countryId, stateId).find(c => c.id === cityId)
  return city?.areas || []
}

export function getLocationName(areaId: string): string {
  for (const country of LOCATIONS) {
    for (const state of country.states) {
      for (const city of state.cities) {
        for (const area of city.areas) {
          if (area.id === areaId) return `${area.name}, ${city.name}, ${state.name}, ${country.name}`
        }
      }
    }
  }
  return areaId
}
