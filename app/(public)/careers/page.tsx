'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import DistrictSelector from '@/components/ui/DistrictSelector'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiUser, FiPhone, FiMail, FiMapPin, FiBriefcase, FiFileText, FiUpload, FiCheck, FiTool, FiImage, FiPackage, FiStar, FiCloud, FiZap } from 'react-icons/fi'

interface ApplicationFormData {
  name: string
  phone: string
  email: string
  district: string
  address: string
  position: string
  experience: string
}

const jobCategories = [
  {
    category: 'Assembly',
    icon: FiTool,
    positions: [
      'Furniture Assembly Technician',
      'Furniture Assembly Specialist',
      'Crib Assembly Expert',
      'Desk & Bookshelf Assembler'
    ]
  },
  {
    category: 'Mounting',
    icon: FiImage,
    positions: [
      'TV Mounting Technician',
      'Art & Shelf Installer',
      'Mirror Mounting Expert',
      'Curtain Installation Technician'
    ]
  },
  {
    category: 'Moving',
    icon: FiPackage,
    positions: [
      'Moving Assistant',
      'Heavy Lifting Specialist',
      'Furniture Removal Crew',
      'Appliance Moving Technician'
    ]
  },
  {
    category: 'Cleaning',
    icon: FiStar,
    positions: [
      'Residential Cleaner',
      'Industrial Cleaner',
      'Deep Cleaning Specialist',
      'Office Cleaner',
      'Move-in/Move-out Cleaner',
      'Sofa & Carpet Cleaner',
      'Window Cleaner'
    ]
  },
  {
    category: 'Outdoor',
    icon: FiCloud,
    positions: [
      'Garden Maintenance Worker',
      'Pool Cleaner',
      'Lawn Care Technician',
      'Gutter Cleaner'
    ]
  },
  {
    category: 'Repairs',
    icon: FiZap,
    positions: [
      'Plumber',
      'Electrician',
      'Painter',
      'Handyman',
      'Door & Window Repair Technician'
    ]
  },
  {
    category: 'General',
    icon: FiBriefcase,
    positions: [
      'Office Admin',
      'Customer Support',
      'Team Supervisor',
      'Operations Manager',
      'Quality Inspector'
    ]
  }
]

const benefits = [
  'Competitive salary',
  'Flexible working hours',
  'Training provided',
  'Career growth opportunities',
  'Staff welfare programs',
  'Work in your district'
]

export default function CareersForm() {
  const router = useRouter()
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvUploading, setCvUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<ApplicationFormData>()

  const district = watch('district')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB')
        return
      }
      setCvFile(file)
    }
  }

  const uploadCV = async (file: File): Promise<string | null> => {
    try {
      setCvUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/upload/cv', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload CV')
      }
      
      const { url } = await response.json()
      return url
    } catch (error: any) {
      console.error('CV upload error:', error)
      toast.error('Failed to upload CV. Application will be submitted without CV.')
      return null
    } finally {
      setCvUploading(false)
    }
  }

  const onSubmit = async (data: ApplicationFormData) => {
    if (!selectedCategory) {
      toast.error('Please select a job category')
      return
    }

    setIsSubmitting(true)
    try {
      let cvUrl: string | null = null
      
      if (cvFile) {
        cvUrl = await uploadCV(cvFile)
      }
      
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, cvUrl })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit application')
      }

      setIsSubmitted(true)
      toast.success('Application submitted successfully!')
      reset()
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen py-24 gradient-bg flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <FiCheck className="text-green-500 text-5xl" />
            </div>
            <h1 className="text-3xl font-bold text-dark-900 mb-4">Application Submitted!</h1>
            <p className="text-gray-600 mb-8">
              Thank you for your interest in joining Maintainex. We will review your application and contact you if you are shortlisted for an interview.
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <WhatsAppButton />
      <main className="pt-20 min-h-screen gradient-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-dark-900 mb-4">Join Our Team</h1>
          <p className="text-dark-900/70">Be part of Sri Lanka&apos;s leading service expert team</p>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg mb-6 sm:mb-8">
          <h3 className="font-bold text-dark-900 mb-4 text-sm sm:text-base">Why Work With Us?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center text-gray-600 text-xs sm:text-sm">
                <FiCheck className="text-primary-500 mr-2 flex-shrink-0" />
                {benefit}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg mb-6 sm:mb-8">
          <h3 className="font-bold text-dark-900 mb-4 text-sm sm:text-base">Open Positions by Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {jobCategories.map((cat) => (
              <div key={cat.category} className="border border-gray-200 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <cat.icon className="text-primary-500" />
                  <h4 className="font-semibold text-dark-900 text-sm sm:text-base">{cat.category}</h4>
                </div>
                <ul className="space-y-1">
                  {cat.positions.slice(0, 3).map((pos) => (
                    <li key={pos} className="text-xs sm:text-sm text-gray-600 flex items-center">
                      <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2" />
                      {pos}
                    </li>
                  ))}
                  {cat.positions.length > 3 && (
                    <li className="text-xs sm:text-sm text-primary-500">
                      +{cat.positions.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-4 sm:p-6 md:p-10 lg:p-12">
          <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4 sm:mb-6">Application Form</h2>

          <div className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiUser className="inline mr-2" />
                  Full Name *
                </label>
                <input
                  type="text"
                  {...register('name', { 
                    required: 'Name is required',
                    pattern: {
                      value: /^[a-zA-Z\s]+$/,
                      message: 'Please enter only English letters'
                    },
                    minLength: {
                      value: 2,
                      message: 'Name must be at least 2 characters'
                    }
                  })}
                  placeholder="John Smith"
                  className="input-field text-sm sm:text-base"
                />
                {errors.name && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiPhone className="inline mr-2" />
                  Phone (10 digits) *
                </label>
                <input
                  type="tel"
                  {...register('phone', { 
                    required: 'Phone number is required',
                    pattern: {
                      value: /^\d{10}$/,
                      message: 'Please enter exactly 10 digits'
                    }
                  })}
                  placeholder="0771234567"
                  maxLength={10}
                  className="input-field text-sm sm:text-base"
                />
                {errors.phone && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                <FiMail className="inline mr-2" />
                Email Address *
              </label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                placeholder="your@email.com"
                className="input-field text-sm sm:text-base"
              />
              {errors.email && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiBriefcase className="inline mr-2" />
                  Job Category *
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value)
                    setValue('position', '')
                  }}
                  className="input-field text-sm sm:text-base"
                >
                  <option value="">Select category</option>
                  {jobCategories.map((cat) => (
                    <option key={cat.category} value={cat.category}>{cat.category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiBriefcase className="inline mr-2" />
                  Position *
                </label>
                <select
                  {...register('position', { required: 'Please select a position' })}
                  className="input-field text-sm sm:text-base"
                  disabled={!selectedCategory}
                >
                  <option value="">Select position</option>
                  {selectedCategory && jobCategories.find(c => c.category === selectedCategory)?.positions.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
                {errors.position && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.position.message}</p>}
              </div>
            </div>

            <DistrictSelector
              value={district || ''}
              onChange={(value) => setValue('district', value, { shouldValidate: true })}
              error={errors.district?.message}
              required
            />

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                <FiMapPin className="inline mr-2" />
                Your Address *
              </label>
              <input
                type="text"
                {...register('address', { required: 'Address is required' })}
                placeholder="Enter your complete address"
                className="input-field text-sm sm:text-base"
              />
              {errors.address && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.address.message}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                <FiFileText className="inline mr-2" />
                Your Experience *
              </label>
              <textarea
                {...register('experience', { required: 'Please describe your experience' })}
                rows={3}
                placeholder="Tell us about your previous work experience..."
                className="input-field resize-none text-sm sm:text-base"
              />
              {errors.experience && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.experience.message}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                <FiUpload className="inline mr-2" />
                Upload CV (PDF, max 5MB) - Optional
              </label>
              <div className="mt-2">
                <label className="cursor-pointer block">
                  <div className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-colors ${
                    cvFile ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
                  }`}>
                    {cvFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FiFileText className="text-primary-500 text-lg sm:text-xl" />
                        <span className="text-primary-700 font-medium text-sm sm:text-base">{cvFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <FiUpload className="mx-auto text-gray-400 text-xl sm:text-2xl mb-2" />
                        <p className="text-gray-600 text-sm">Click to upload CV</p>
                        <p className="text-gray-400 text-xs mt-1">PDF only</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </label>
                {cvFile && (
                  <button
                    type="button"
                    onClick={() => setCvFile(null)}
                    className="text-red-500 hover:text-red-700 text-sm mt-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-800">
                <strong>Note:</strong> Upload your CV in PDF format. If you don&apos;t have a CV ready, you can still submit your application.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || cvUploading}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base py-3"
            >
              {cvUploading ? 'Uploading CV...' : isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
      </main>
      <Footer />
    </>
  )
}
