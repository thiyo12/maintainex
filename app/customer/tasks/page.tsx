'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiLoader, FiPlus, FiMapPin, FiDollarSign, FiClock, FiCalendar } from 'react-icons/fi'

export default function CustomerTasksPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (!data.user || data.user.role !== 'CUSTOMER') {
        router.push('/auth/login')
        return
      }
      fetchTasks()
    } catch {
      router.push('/auth/login')
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks')
      const result = await res.json()
      if (result.success) {
        setTasks(result.data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
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
    DISPUTED: 'bg-orange-100 text-orange-700',
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FiLoader className="animate-spin text-4xl text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link href="/customer/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900 mt-1">My Tasks</h1>
          </div>
          <Link href="/customer/post-task" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            <FiPlus size={16} />
            Post Task
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'PENDING_REVIEW', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                filter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Tasks */}
        {filteredTasks.length > 0 ? (
          <div className="grid gap-4">
            {filteredTasks.map((task) => (
              <Link
                key={task.id}
                href={`/customer/tasks/${task.id}`}
                className="bg-white rounded-xl border p-6 hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                    <p className="text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                      {task.category && (
                        <span>{task.category.icon} {task.category.name}</span>
                      )}
                      {task.budget && (
                        <span className="flex items-center gap-1">
                          <FiDollarSign size={14} /> LKR {task.budget.toLocaleString()}
                        </span>
                      )}
                      {task.district && (
                        <span className="flex items-center gap-1">
                          <FiMapPin size={14} /> {task.district}
                        </span>
                      )}
                      {task.startDate && (
                        <span className="flex items-center gap-1">
                          <FiCalendar size={14} /> {new Date(task.startDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <FiClock size={14} /> {task.applicationsCount || 0} applications
                      </span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ml-4 ${statusColors[task.status]}`}>
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FiCalendar className="text-6xl text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks found</h3>
            <p className="text-gray-500 mb-6">
              {filter !== 'all' ? 'Try a different filter or' : 'Get started by posting your first task'}
            </p>
            <Link
              href="/customer/post-task"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700"
            >
              <FiPlus size={16} />
              Post a Task
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
