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
              { id: 'area-col-01', name: 'Colombo 01 - Fort' },
              { id: 'area-col-02', name: 'Colombo 02 - Kollupitiya' },
              { id: 'area-col-03', name: 'Colombo 03 - Krambay' },
              { id: 'area-col-04', name: 'Colombo 04 - Slave Island' },
              { id: 'area-col-05', name: 'Colombo 05 - Hulftsdorp' },
              { id: 'area-col-06', name: 'Colombo 06 - Wellampitiya' },
              { id: 'area-col-07', name: 'Colombo 07 - Cinnamon Gardens' },
              { id: 'area-col-08', name: 'Colombo 08 - Bambalapitiya' },
              { id: 'area-col-09', name: 'Colombo 09 - Wellawatte' },
              { id: 'area-col-10', name: 'Colombo 10 - Dematagoda' },
              { id: 'area-col-11', name: 'Colombo 11 - Maradana' },
              { id: 'area-col-12', name: 'Colombo 12 - Pettah' },
              { id: 'area-col-13', name: 'Colombo 13 - Kotahena' },
              { id: 'area-col-14', name: 'Colombo 14 - Grandpass' },
              { id: 'area-col-15', name: 'Colombo 15 - Mutwal' },
            ],
          },
          {
            id: 'lk-gampaha',
            name: 'Gampaha',
            areas: [
              { id: 'area-gam-01', name: 'Gampaha Town' },
              { id: 'area-gam-02', name: 'Negombo' },
              { id: 'area-gam-03', name: 'Katunayake' },
              { id: 'area-gam-04', name: 'Ja-Ela' },
              { id: 'area-gam-05', name: 'Kelaniya' },
            ],
          },
          {
            id: 'lk-kalutara',
            name: 'Kalutara',
            areas: [
              { id: 'area-kal-01', name: 'Kalutara Town' },
              { id: 'area-kal-02', name: 'Panadura' },
              { id: 'area-kal-03', name: 'Horana' },
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
              { id: 'area-kan-01', name: 'Kandy City' },
              { id: 'area-kan-02', name: 'Peradeniya' },
              { id: 'area-kan-03', name: 'Katugastota' },
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
              { id: 'area-gal-01', name: 'Galle Fort' },
              { id: 'area-gal-02', name: 'Galle City' },
            ],
          },
          {
            id: 'lk-matara',
            name: 'Matara',
            areas: [
              { id: 'area-mat-01', name: 'Matara City' },
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
              { id: 'area-jaf-01', name: 'Jaffna City' },
              { id: 'area-jaf-02', name: 'Nallur' },
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
        id: 'ca-on',
        name: 'Ontario',
        cities: [
          {
            id: 'ca-toronto',
            name: 'Toronto',
            areas: [
              { id: 'area-to-01', name: 'Downtown' },
              { id: 'area-to-02', name: 'Scarborough' },
              { id: 'area-to-03', name: 'North York' },
              { id: 'area-to-04', name: 'Etobicoke' },
              { id: 'area-to-05', name: 'Mississauga' },
              { id: 'area-to-06', name: 'Brampton' },
              { id: 'area-to-07', name: 'Markham' },
              { id: 'area-to-08', name: 'Richmond Hill' },
            ],
          },
          {
            id: 'ca-mississauga',
            name: 'Mississauga',
            areas: [
              { id: 'area-ms-01', name: 'City Centre' },
              { id: 'area-ms-02', name: 'Erin Mills' },
              { id: 'area-ms-03', name: 'Square One' },
            ],
          },
        ],
      },
    ],
  },
]

export function getLocationName(areaId: string): string {
  for (const country of LOCATIONS) {
    for (const state of country.states) {
      for (const city of state.cities) {
        for (const area of city.areas) {
          if (area.id === areaId) return `${area.name}, ${city.name}`
        }
      }
    }
  }
  return areaId
}
