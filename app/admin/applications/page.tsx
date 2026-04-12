'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { FiEye, FiTrash2, FiCheck, FiDownload, FiMail, FiRefreshCw, FiMapPin, FiEdit2 } from 'react-icons/fi'
import DistrictSelector, { DISTRICTS } from '@/components/ui/DistrictSelector'

interface Application {
  id: string
  name: string
  phone: string
  email: string
  district: string
  address: string
  position: string
  experience: string
  cvUrl: string | null
  status: string
  branch: { id: string; name: string; location: string } | null
  createdAt: string
}

interface Branch {
  id: string
  name: string
  location: string
  districts: string
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  REVIEWED: 'bg-purple-100 text-purple-700',
  INTERVIEW: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  HIRED: 'bg-green-100 text-green-700'
}

export default function AdminApplications() {
  const { data: session } = useSession()
  const [applications, setApplications] = useState<Application[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [filterBranch, setFilterBranch] = useState<string>('')
  const [editingApp, setEditingApp] = useState<Application | null>(null)
  const [editDistrict, setEditDistrict] = useState('')
  const [editBranchId, setEditBranchId] = useState('')

  const isSuperAdmin = (session?.user as any)?.role === 'SUPER_ADMIN'

  useEffect(() => {
    fetchApplications()
    if (isSuperAdmin) {
      fetchBranches()
    }
  }, [])

  const fetchApplications = async () => {
    try {
      const params = new URLSearchParams()
      if (filterBranch) params.append('branchId', filterBranch)
      
      const url = params.toString() ? `/api/applications?${params}` : '/api/applications'
      const res = await fetch(url)
      const data = await res.json()
      setApplications(data)
    } catch (error) {
      toast.error('Failed to fetch applications')
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches')
      const data = await res.json()
      setBranches(data)
    } catch (error) {
      console.error('Failed to fetch branches')
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (!res.ok) throw new Error()
      
      toast.success('Application status updated')
      fetchApplications()
    } catch (error) {
      toast.error('Failed to update application')
    }
  }

  const updateDistrict = async () => {
    if (!editingApp) return
    
    try {
      let branchId = null
      if (editBranchId) {
        branchId = editBranchId
      } else if (editDistrict) {
        const branch = branches.find(b => {
          const districts: string[] = JSON.parse(b.districts || '[]')
          return districts.includes(editDistrict)
        })
        branchId = branch?.id || null
      }

      const res = await fetch(`/api/applications/${editingApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          district: editDistrict,
          branchId 
        })
      })
      
      if (!res.ok) throw new Error()
      
      toast.success('Application updated')
      setEditingApp(null)
      fetchApplications()
    } catch (error) {
      toast.error('Failed to update application')
    }
  }

  const deleteApplication = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return
    
    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      
      toast.success('Application deleted')
      fetchApplications()
    } catch (error) {
      toast.error('Failed to delete application')
    }
  }

  const openEditModal = (app: Application) => {
    setEditingApp(app)
    setEditDistrict(app.district)
    setEditBranchId(app.branch?.id || '')
  }

  const filteredApps = filter === 'ALL' 
    ? applications 
    : applications.filter(a => a.status === filter)

  const assignedApps = applications.filter(a => a.branch !== null)
  const unassignedApps = applications.filter(a => a.branch === null)

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
          <h1 className="text-2xl font-bold text-gray-900">Job Applications</h1>
          <p className="text-gray-600">Review and manage job applications</p>
        </div>
        <button onClick={fetchApplications} className="btn-outline flex items-center">
          <FiRefreshCw className="mr-2" /> Refresh
        </button>
      </div>

      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Total Applications</div>
            <div className="text-3xl font-bold text-gray-900">{applications.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Assigned</div>
            <div className="text-3xl font-bold text-green-600">{assignedApps.length}</div>
          </div>
          <div className={`bg-white rounded-xl shadow-sm p-6 ${unassignedApps.length > 0 ? 'ring-2 ring-red-500' : ''}`}>
            <div className="text-sm text-gray-500 mb-1">Unassigned</div>
            <div className={`text-3xl font-bold ${unassignedApps.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {unassignedApps.length}
            </div>
            {unassignedApps.length > 0 && (
              <div className="text-xs text-red-500 mt-1">⚠️ Needs attention</div>
            )}
          </div>
        </div>
      )}

      {isSuperAdmin && unassignedApps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold text-red-800">Unassigned Applications - Require Branch Assignment</h2>
          </div>
          <div className="bg-white rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-red-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">Applicant</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">District</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">Position</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">Applied</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-red-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {unassignedApps.map((app) => (
                  <tr key={app.id} className="hover:bg-red-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{app.name}</div>
                      <div className="text-sm text-gray-500">{app.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{app.district}</td>
                    <td className="px-4 py-3 text-gray-700">{app.position}</td>
                    <td className="px-4 py-3 text-gray-700">{new Date(app.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(app)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                      >
                        Assign Branch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'NEW', 'REVIEWED', 'INTERVIEW', 'REJECTED', 'HIRED'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary-500 text-dark-900'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <select
            value={filterBranch}
            onChange={(e) => {
              setFilterBranch(e.target.value)
              fetchApplications()
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Branches</option>
            <option value="unassigned">Unassigned</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Applicant</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">District</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Branch</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Position</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Applied</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredApps.length > 0 ? (
                filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{app.name}</div>
                      <div className="text-sm text-gray-500">{app.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-gray-700">
                        <FiMapPin className="text-gray-400" />
                        {app.district}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {app.branch ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {app.branch.name}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{app.position}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[app.status]}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        {isSuperAdmin && (
                          <button
                            onClick={() => openEditModal(app)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                            title="Edit District"
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                        <a
                          href={`mailto:${app.email}`}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Send Email"
                        >
                          <FiMail />
                        </a>
                        {app.cvUrl && (
                          <a
                            href={app.cvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                            title="Download CV"
                          >
                            <FiDownload />
                          </a>
                        )}
                        <button
                          onClick={() => deleteApplication(app.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No applications found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Application Details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Full Name</label>
                <div className="font-medium">{selectedApp.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Phone</label>
                  <div className="font-medium">{selectedApp.phone}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <div className="font-medium">{selectedApp.email}</div>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">District</label>
                <div className="font-medium">{selectedApp.district}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Address</label>
                <div className="font-medium">{selectedApp.address}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Branch</label>
                <div className="font-medium">{selectedApp.branch?.name || 'Unassigned'}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Position</label>
                <div className="font-medium">{selectedApp.position}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Experience</label>
                <div className="text-gray-700 whitespace-pre-wrap">{selectedApp.experience}</div>
              </div>
              {selectedApp.cvUrl && (
                <div>
                  <label className="text-sm text-gray-500">CV</label>
                  <a
                    href={selectedApp.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    View CV
                  </a>
                </div>
              )}
              
              <div className="pt-4 border-t">
                <label className="text-sm text-gray-500 mb-2 block">Update Status</label>
                <div className="flex flex-wrap gap-2">
                  {['NEW', 'REVIEWED', 'INTERVIEW', 'REJECTED', 'HIRED'].map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        updateStatus(selectedApp.id, status)
                        setSelectedApp({ ...selectedApp, status })
                      }}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        selectedApp.status === status
                          ? statusColors[status]
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Edit Application</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Applicant</label>
                <div className="font-medium">{editingApp.name}</div>
              </div>
              <DistrictSelector
                value={editDistrict}
                onChange={setEditDistrict}
                required
              />
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Override</label>
                  <select
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Auto-assign based on district</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to auto-assign based on district</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditingApp(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={updateDistrict}
                className="flex-1 btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
