'use client'

import { useState, useCallback, useRef } from 'react'
import Cropper, { Area, Point } from 'react-easy-crop'
import { FiX, FiCheck, FiRotateCw } from 'react-icons/fi'

interface ImageCropperProps {
  imageSrc: string
  onCropComplete: (file: File) => void
  onCancel: () => void
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [cropping, setCropping] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const onCropCompleteHandler = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return

    setCropping(true)
    try {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = imageSrc
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setCropping(false)
        return
      }

      const rotRad = (rotation * Math.PI) / 180
      const sin = Math.abs(Math.sin(rotRad))
      const cos = Math.abs(Math.cos(rotRad))

      const bBoxWidth = image.width * cos + image.height * sin
      const bBoxHeight = image.width * sin + image.height * cos

      canvas.width = bBoxWidth
      canvas.height = bBoxHeight

      ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
      ctx.rotate(rotRad)
      ctx.translate(-image.width / 2, -image.height / 2)
      ctx.drawImage(image, 0, 0)

      const data = ctx.getImageData(
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      )

      canvas.width = croppedAreaPixels.width
      canvas.height = croppedAreaPixels.height
      ctx.putImageData(data, 0, 0)

      canvas.toBlob((blob) => {
        if (!blob) {
          setCropping(false)
          return
        }
        const file = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCropComplete(file)
      }, 'image/jpeg', 0.95)
    } catch (error) {
      console.error('Error creating cropped image:', error)
    } finally {
      setCropping(false)
    }
  }, [imageSrc, croppedAreaPixels, rotation, onCropComplete])

  const rotateLeft = () => setRotation((r) => (r - 90) % 360)
  const rotateRight = () => setRotation((r) => (r + 90) % 360)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Crop Image</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={rotateLeft}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Rotate left"
            >
              <FiRotateCw className="w-5 h-5 transform -scale-x-100" />
            </button>
            <button
              type="button"
              onClick={rotateRight}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Rotate right"
            >
              <FiRotateCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative min-h-[300px] max-h-[50vh]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
            rotation={rotation}
          />
        </div>

        <div className="p-4 border-t">
          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-2 block">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center gap-2"
            >
              <FiX className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={createCroppedImage}
              disabled={cropping}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {cropping ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiCheck className="w-4 h-4" />
              )}
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}