'use client'

import { useState } from 'react'

interface MapPickerProps {
  value: { lat: number; lng: number } | null
  onChange: (location: { lat: number; lng: number; address: string }) => void
}

export function MapPicker({ value, onChange }: MapPickerProps) {
  const [search, setSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState(value)

  const handleMapClick = (e: any) => {
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    setSelectedLocation({ lat, lng })
    onChange({
      lat,
      lng,
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    })
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search for your address..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field"
      />
      <div className="w-full h-64 bg-gray-200 rounded-lg overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          <p>Click on the map to select your location</p>
        </div>
        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
              <span className="text-white text-xs">📍</span>
            </div>
            <p className="text-sm text-gray-600">Map Preview</p>
            {selectedLocation && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>
      </div>
      {selectedLocation && (
        <input type="hidden" name="latitude" value={selectedLocation.lat} />
      )}
      {selectedLocation && (
        <input type="hidden" name="longitude" value={selectedLocation.lng} />
      )}
    </div>
  )
}
