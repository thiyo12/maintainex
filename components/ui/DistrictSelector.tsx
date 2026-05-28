'use client'

import { FiMapPin } from 'react-icons/fi'
import { useRegion } from '@/lib/region-context'
import { DISTRICTS as LK_DISTRICTS } from '@/lib/districts'

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
  const region = useRegion()
  const districts = region.districts

  return (
    <div>
      <label className="block text-gray-700 font-medium mb-2">
        <FiMapPin className="inline mr-2" />
        {region.label === 'Canada' ? 'City' : 'District'} {required && '*'}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
        required={required}
      >
        <option value="">Select your {region.label === 'Canada' ? 'city' : 'district'}</option>
        {districts.map((district) => (
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

export { LK_DISTRICTS as DISTRICTS }
