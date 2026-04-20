'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiStar, FiCheck, FiTrash2, FiRefreshCw, FiClock } from 'react-icons/fi'
import { getAuthHeader } from '@/lib/auth-client'

interface Review {
  id: string
  rating: number
  comment: string | null
  status: string
  customerName: string | null
  createdAt: string
  service: {
    id: string
    name: string
    slug: string | null
  }
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/reviews', { headers: { ...authHeaders } })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      const data = await res.json()
      setReviews(data || [])
    } catch (error) {
      toast.error('Failed to fetch reviews')
    } finally {
      setLoading(false)
    }
  }

  const approveReview = async (id: string) => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: 'APPROVED' })
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) throw new Error()

      toast.success('Review approved successfully')
      fetchReviews()
    } catch (error) {
      toast.error('Failed to approve review')
    }
  }

  const rejectReview = async (id: string) => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status: 'REJECTED' })
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) throw new Error()

      toast.success('Review rejected')
      fetchReviews()
    } catch (error) {
      toast.error('Failed to reject review')
    }
  }

  const deleteReview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/reviews/${id}`, { 
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) throw new Error()

      toast.success('Review deleted successfully')
      fetchReviews()
    } catch (error) {
      toast.error('Failed to delete review')
    }
  }

  const filteredReviews = filter === 'ALL' 
    ? reviews 
    : reviews.filter(r => r.status === filter)

  const pendingCount = reviews.filter(r => r.status === 'PENDING').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-gray-600">Manage customer reviews and ratings</p>
        </div>
        <button onClick={fetchReviews} className="btn-outline flex items-center">
          <FiRefreshCw className="mr-2" /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-full font-medium transition-colors ${
              filter === status
                ? 'bg-primary-500 text-dark-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            {status === 'PENDING' && pendingCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length > 0 ? (
          filteredReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <FiStar
                          key={i}
                          className={`w-5 h-5 ${
                            i < review.rating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold text-gray-900">{review.customerName}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      review.status === 'APPROVED'
                        ? 'bg-green-100 text-green-700'
                        : review.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {review.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mb-2">
                    Service: <span className="text-gray-700 font-medium">{review.service.name}</span>
                  </p>

                  {review.comment && (
                    <p className="text-gray-700 mb-2">&ldquo;{review.comment}&rdquo;</p>
                  )}

                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <FiClock className="w-3 h-3" />
                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div className="flex md:flex-col gap-2">
                  {review.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => approveReview(review.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        title="Approve"
                      >
                        <FiCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Approve</span>
                      </button>
                      <button
                        onClick={() => rejectReview(review.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                        title="Reject"
                      >
                        <FiTrash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Reject</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteReview(review.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">No reviews found.</p>
          </div>
        )}
      </div>
    </div>
  )
}
