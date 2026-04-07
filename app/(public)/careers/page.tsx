'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import DistrictSelector from '@/components/ui/DistrictSelector'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiUser, FiPhone, FiMail, FiMapPin, FiBriefcase, FiFileText, FiUpload, FiCheck } from 'react-icons/fi'

interface ApplicationFormData {
  name: string
  phone: string
  email: string
  district: string
  address: string
  position: string
  experience: string
}

const positions = [
  'Cleaning Staff',
  'Supervisor',
  'Team Leader',
  'Admin Staff',
  'Customer Service',
  'Driver',
  'Operations Manager'
]

const benefits = [
  'Competitive salary',
  'Flexible working hours',
  'Training provided',
  'Career growth opportunities',
  'Staff welfare programs'
]

export default function CareersForm() {
  const router = useRouter()
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvUploading, setCvUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ApplicationFormData>()

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
        throw new Error('Failed to submit application')
      }

      setIsSubmitted(true)
      toast.success('Application submitted successfully!')
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
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
          <p className="text-dark-900/70">Be part of Sri Lanka&apos;s leading cleaning service team</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-dark-900 mb-4">Why Work With Us?</h3>
            <ul className="space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center text-gray-600">
                  <FiCheck className="text-primary-500 mr-2" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="font-bold text-dark-900 mb-4">Open Positions</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {positions.map((position) => (
                <div key={position} className="flex items-center text-gray-600">
                  <FiBriefcase className="text-primary-500 mr-2" />
                  {position}
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          <h2 className="text-2xl font-bold text-dark-900 mb-6">Application Form</h2>

          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <FiUser className="inline mr-2" />
                  Full Name *
                </label>
                <input
                  type="text"
                  {...register('name', { required: 'Name is required' })}
                  placeholder="Enter your full name"
                  className="input-field"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <FiPhone className="inline mr-2" />
                  Phone Number *
                </label>
                <input
                  type="tel"
                  {...register('phone', { required: 'Phone number is required' })}
                  placeholder="077XXXXXXX"
                  className="input-field"
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                <FiMail className="inline mr-2" />
                Email Address *
              </label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                placeholder="your@email.com"
                className="input-field"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  <FiBriefcase className="inline mr-2" />
                  Position Applied For *
                </label>
                <select
                  {...register('position', { required: 'Please select a position' })}
                  className="input-field"
                >
                  <option value="">Select a position</option>
                  {positions.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
                {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position.message}</p>}
              </div>

              <DistrictSelector
                value={district || ''}
                onChange={(value) => setValue('district', value, { shouldValidate: true })}
                error={errors.district?.message}
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                <FiMapPin className="inline mr-2" />
                Your Address *
              </label>
              <input
                type="text"
                {...register('address', { required: 'Address is required' })}
                placeholder="Enter your complete address"
                className="input-field"
              />
              {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                <FiFileText className="inline mr-2" />
                Your Experience *
              </label>
              <textarea
                {...register('experience', { required: 'Please describe your experience' })}
                rows={4}
                placeholder="Tell us about your previous work experience, skills, and why you want to join our team..."
                className="input-field resize-none"
              />
              {errors.experience && <p className="text-red-500 text-sm mt-1">{errors.experience.message}</p>}
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">
                <FiUpload className="inline mr-2" />
                Upload CV (PDF only, max 5MB) - Optional
              </label>
              <div className="mt-2 flex items-center gap-4">
                <label className="flex-1 cursor-pointer">
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                    cvFile ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
                  }`}>
                    {cvFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FiFileText className="text-primary-500 text-xl" />
                        <span className="text-primary-700 font-medium">{cvFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <FiUpload className="mx-auto text-gray-400 text-2xl mb-2" />
                        <p className="text-gray-600">Click to upload CV</p>
                        <p className="text-gray-400 text-sm mt-1">PDF only</p>
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
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Upload your CV in PDF format (max 5MB). If you don&apos;t have a CV ready, you can still submit your application with just your experience details.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || cvUploading}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
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
