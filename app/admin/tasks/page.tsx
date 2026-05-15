'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiLoader, FiCheck, FiX, FiEye, FiMapPin, FiDollarSign, FiClock, FiSearch } from 'react-icons/fi'

export default function AdminTasksPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState('PENDING_REVIEW')
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (!data.user || !['ADMIN', 'SUPER_ADMIN'].includes(data.user.role)) {
        router.push('/admin/login')
        return
      }
      fetchTasks()
    } catch {
      router.push('/admin/login')
    }
  }

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks?status=${filter}`)
      const result = await res.json()
      if (result.success) setTasks(result.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (taskId: string, action: 'approve' | 'reject') => {
    setProcessing(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          adminNotes,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setSelectedTask(null)
        setAdminNotes('')
        fetchTasks()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setProcessing(false)
    }
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    OPEN: 'bg-green-100 text-green-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    REJECTED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-bold text-gray-900 mt-1">Task Review Queue</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { value: 'PENDING_REVIEW', label: 'Pending Review', count: tasks.filter(t => t.status === 'PENDING_REVIEW').length },
            { value: 'APPROVED', label: 'Approved', count: 0 },
            { value: 'OPEN', label: 'Open', count: 0 },
            { value: 'IN_PROGRESS', label: 'In Progress', count: 0 },
            { value: 'COMPLETED', label: 'Completed', count: 0 },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                filter === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <FiLoader className="animate-spin text-4xl text-indigo-600 mx-auto" />
          </div>
        ) : tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white rounded-xl border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-2 line-clamp-2">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                      {task.category && <span>{task.category.icon} {task.category.name}</span>}
                      {task.budget && <span className="flex items-center gap-1"><FiDollarSign size={14} /> LKR {task.budget.toLocaleString()}</span>}
                      {task.district && <span className="flex items-center gap-1"><FiMapPin size={14} /> {task.district}</span>}
                      <span className="flex items-center gap-1"><FiClock size={14} /> {new Date(task.createdAt).toLocaleDateString()}</span>
                      {task.applicationsCount > 0 && <span>{task.applicationsCount} applications</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-gray-500">Customer:</span>
                      <span className="font-medium">{task.customer?.user?.name || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <FiEye size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FiCheck className="text-6xl text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks to review</h3>
            <p className="text-gray-500">All caught up!</p>
          </div>
        )}

        {/* Review Modal */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Review Task</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedTask.title}</h3>
                  <p className="text-gray-600 mt-2">{selectedTask.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                  <div>
                    <span className="text-sm text-gray-500">Category</span>
                    <p className="font-medium">{selectedTask.category?.name || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Budget</span>
                    <p className="font-medium">{selectedTask.budget ? `LKR ${selectedTask.budget.toLocaleString()}` : 'Negotiable'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Location</span>
                    <p className="font-medium">{selectedTask.district || 'Remote'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Customer</span>
                    <p className="font-medium">{selectedTask.customer?.user?.name || 'Unknown'}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none resize-none"
                    rows={3}
                    placeholder="Add internal notes about this task..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleReview(selectedTask.id, 'approve')}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 font-medium disabled:opacity-50"
                  >
                    <FiCheck size={18} />
                    Approve & Publish
                  </button>
                  <button
                    onClick={() => handleReview(selectedTask.id, 'reject')}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 font-medium disabled:opacity-50"
                  >
                    <FiX size={18} />
                    Reject
                  </button>
                </div>

                <button
                  onClick={() => { setSelectedTask(null); setAdminNotes('') }}
                  className="w-full text-gray-500 py-2 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
