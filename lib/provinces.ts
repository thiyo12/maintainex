export const PROVINCES = [
  "Western Province",
  "Central Province",
  "Southern Province",
  "Northern Province",
  "Eastern Province",
  "North Western Province",
  "North Central Province",
  "Uva Province",
  "Sabaragamuwa Province"
]

export const DISTRICT_TO_PROVINCE: Record<string, string> = {
  // Western Province
  "Colombo": "Western Province",
  "Gampaha": "Western Province",
  "Kalutara": "Western Province",
  
  // Central Province
  "Kandy": "Central Province",
  "Matale": "Central Province",
  "Nuwara Eliya": "Central Province",
  
  // Southern Province
  "Galle": "Southern Province",
  "Matara": "Southern Province",
  "Hambantota": "Southern Province",
  
  // Northern Province
  "Jaffna": "Northern Province",
  "Kilinochchi": "Northern Province",
  "Mannar": "Northern Province",
  "Mullaitivu": "Northern Province",
  "Vavuniya": "Northern Province",
  
  // Eastern Province
  "Trincomalee": "Eastern Province",
  "Batticaloa": "Eastern Province",
  "Ampara": "Eastern Province",
  
  // North Western Province
  "Kurunegala": "North Western Province",
  "Puttalam": "North Western Province",
  
  // North Central Province
  "Anuradhapura": "North Central Province",
  "Polonnaruwa": "North Central Province",
  
  // Uva Province
  "Badulla": "Uva Province",
  "Monaragala": "Uva Province",
  
  // Sabaragamuwa Province
  "Ratnapura": "Sabaragamuwa Province",
  "Kegalle": "Sabaragamuwa Province"
}

export function getProvinceFromDistrict(district: string): string | null {
  return DISTRICT_TO_PROVINCE[district] || null
}

export function getDistrictsByProvince(province: string): string[] {
  return Object.entries(DISTRICT_TO_PROVINCE)
    .filter(([_, p]) => p === province)
    .map(([district]) => district)
}
