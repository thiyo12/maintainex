'use client'

import { FiMapPin } from 'react-icons/fi'

const DISTRICTS = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya'
].sort()

interface DistrictSelectorProps {
  value: string
  onChange: (district: string) => void
  error?: string
  required?: boolean
}

export default function DistrictSelector({ 
  value, 
  onChange, 
  error, 
  required = false 
}: DistrictSelectorProps) {
  return (
    <div>
      <label className="block text-gray-700 font-medium mb-2">
        <FiMapPin className="inline mr-2" />
        District {required && '*'}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
        required={required}
      >
        <option value="">Select your district</option>
        {DISTRICTS.map((district) => (
          <option key={district} value={district}>
            {district}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
    </div>
  )
}

export { DISTRICTS }
