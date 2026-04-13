'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { FiUpload, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface ImageUploaderProps {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
}

export default function ImageUploader({ value, onChange, disabled }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentValue, setCurrentValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCurrentValue(value)
  }, [value])

  const handleUpload = async (file: File) => {
    if (disabled) return

    setError(null)
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload jpg, png, or webp images.')
      setError('Invalid file type')
      return
    }

    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size exceeds 20MB limit')
      setError('File too large')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/service', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      
      onChange(data.url)
      toast.success('Image uploaded successfully!')
      setUploadProgress(100)
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Failed to upload image')
      setError(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    
    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file) {
      handleUpload(file)
    }
  }, [disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const removeImage = () => {
    onChange('')
    setError(null)
  }

  const openFileDialog = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  if (currentValue) {
    return (
      <div className="space-y-3">
        <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-green-200 bg-green-50">
          <Image
            src={currentValue}
            alt="Uploaded"
            width={400}
            height={200}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
            <FiCheck className="w-3 h-3" />
            Uploaded
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
        {currentValue.startsWith('/uploads/') && !disabled && (
          <button
            type="button"
            onClick={openFileDialog}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Change Image
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={`
          relative flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileDialog}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-gray-600 font-medium">Uploading...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center">
            <div className="p-3 bg-red-100 rounded-full mb-3">
              <FiAlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <span className="text-red-600 font-medium">Upload failed</span>
            <span className="text-red-400 text-sm">{error}</span>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setError(null); }}
              className="mt-2 text-sm text-primary-600 hover:text-primary-700"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className={`p-4 rounded-full ${dragging ? 'bg-primary-100' : 'bg-gray-100'} mb-3`}>
              {dragging ? (
                <FiCheck className="w-8 h-8 text-primary-500" />
              ) : (
                <FiUpload className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <span className="text-gray-600 font-medium">
              {dragging ? 'Drop image here' : 'Click or drag image here'}
            </span>
            <span className="text-gray-400 text-sm mt-1">
              JPG, PNG, or WebP (max 20MB)
            </span>
          </>
        )}
        
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={disabled}
        />
      </div>
      
      <p className="text-xs text-gray-500">
        Or paste an image URL manually in the field below
      </p>
    </div>
  )
}
