'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiTrash2, FiEdit2, FiX, FiFileText, FiArrowRight } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface QuotationItem {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Quotation {
  id: string
  quotationNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerAddress: string | null
  subtotal: number
  tax: number
  total: number
  status: string
  validUntil: string
  notes: string | null
  createdAt: string
  branch: { id: string; name: string }
  items: QuotationItem[]
}

interface Branch {
  id: string
  name: string
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-orange-100 text-orange-700',
  CONVERTED: 'bg-purple-100 text-purple-700'
}

export default function AdminQuotations() {
  const { user } = useAdminSession()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBranch, setFilterBranch] = useState('')

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    branchId: '',
    subtotal: 0,
    tax: 0,
    total: 0,
    validUntil: '',
    notes: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }] as QuotationItem[]
  })

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    fetchQuotations()
    if (isSuperAdmin) fetchBranches()
  }, [filterStatus, filterBranch])

  const fetchQuotations = async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (filterBranch) params.append('branchId', filterBranch)
      
      const url = `/api/quotations${params.toString() ? '?' + params : ''}`
      const res = await fetch(url, { headers: getAuthHeader() })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      const data = await res.json()
      if (Array.isArray(data)) {
        setQuotations(data)
      }
    } catch (err) {
      toast.error('Failed to fetch quotations')
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches', { headers: getAuthHeader() })
      const data = await res.json()
      if (Array.isArray(data)) {
        setBranches(data)
      }
    } catch (err) {
      console.error('Failed to fetch branches')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingQuotation ? `/api/quotations/${editingQuotation.id}` : '/api/quotations'
      const method = editingQuotation ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error()

      toast.success(editingQuotation ? 'Quotation updated' : 'Quotation created')
      setShowModal(false)
      resetForm()
      fetchQuotations()
    } catch (err) {
      toast.error('Failed to save quotation')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return
    
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      })

      if (!res.ok) throw new Error()
      toast.success('Quotation deleted')
      fetchQuotations()
    } catch (err) {
      toast.error('Failed to delete quotation')
    }
  }

  const handleConvertToInvoice = async (quotation: Quotation) => {
    if (!confirm('Convert this quotation to an invoice?')) return
    
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ convertToInvoice: true })
      })

      if (!res.ok) throw new Error()
      
      toast.success('Converted to invoice')
      fetchQuotations()
    } catch (err) {
      toast.error('Failed to convert quotation')
    }
  }

  const openEdit = (quotation: Quotation) => {
    setEditingQuotation(quotation)
    setFormData({
      customerName: quotation.customerName,
      customerEmail: quotation.customerEmail || '',
      customerPhone: quotation.customerPhone || '',
      customerAddress: quotation.customerAddress || '',
      branchId: quotation.branch.id,
      subtotal: quotation.subtotal,
      tax: quotation.tax,
      total: quotation.total,
      validUntil: quotation.validUntil ? quotation.validUntil.split('T')[0] : '',
      notes: quotation.notes || '',
      items: quotation.items.length > 0 ? quotation.items : [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingQuotation(null)
    setFormData({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerAddress: '',
      branchId: '',
      subtotal: 0,
      tax: 0,
      total: 0,
      validUntil: '',
      notes: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]
    })
  }

  const updateItemTotal = (index: number, field: keyof QuotationItem, value: string | number) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].totalPrice = Number(newItems[index].quantity) * Number(newItems[index].unitPrice)
    }
    
    setFormData({
      ...formData,
      items: newItems,
      subtotal: newItems.reduce((sum, item) => sum + item.totalPrice, 0),
      total: newItems.reduce((sum, item) => sum + item.totalPrice, 0) + formData.tax
    })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]
    })
  }

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      items: newItems.length > 0 ? newItems : [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
      subtotal: newItems.reduce((sum, item) => sum + item.totalPrice, 0),
      total: newItems.reduce((sum, item) => sum + item.totalPrice, 0) + formData.tax
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-600">Manage quotations and convert to invoices</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <FiPlus className="w-4 h-4" /> New Quotation
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>

        {isSuperAdmin && (
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Quotation #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Valid Until</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No quotations found
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{quotation.quotationNumber}</td>
                    <td className="px-4 py-3">
                      <div>{quotation.customerName}</div>
                      <div className="text-sm text-gray-500">{quotation.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      LKR {quotation.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[quotation.status] || 'bg-gray-100'}`}>
                        {quotation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(quotation.validUntil).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {quotation.status !== 'CONVERTED' && (
                          <button
                            onClick={() => handleConvertToInvoice(quotation)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Convert to Invoice"
                          >
                            <FiArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(quotation)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(quotation.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold">{editingQuotation ? 'Edit Quotation' : 'New Quotation'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Branch *</label>
                  <select
                    required
                    value={formData.branchId}
                    onChange={(e) => setFormData({...formData, branchId: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({...formData, customerAddress: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Line Items</label>
                  <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:underline">
                    + Add Item
                  </button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-start">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItemTotal(index, 'description', e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItemTotal(index, 'quantity', e.target.value)}
                      className="w-16 px-2 py-2 border rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => updateItemTotal(index, 'unitPrice', e.target.value)}
                      className="w-24 px-2 py-2 border rounded-lg text-sm"
                    />
                    <div className="w-24 px-2 py-2 text-sm font-medium">
                      LKR {item.totalPrice.toLocaleString()}
                    </div>
                    <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-600">
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tax</label>
                  <input
                    type="number"
                    value={formData.tax}
                    onChange={(e) => setFormData({
                      ...formData,
                      tax: Number(e.target.value),
                      total: formData.subtotal + Number(e.target.value)
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Total</label>
                  <div className="w-full px-3 py-2 bg-gray-100 rounded-lg font-bold">
                    LKR {formData.total.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valid Until *</label>
                  <input
                    type="date"
                    required
                    value={formData.validUntil}
                    onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingQuotation ? 'Update' : 'Create'} Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}