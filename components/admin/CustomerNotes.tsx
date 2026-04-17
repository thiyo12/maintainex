'use client'

import { useState } from 'react'
import { FiSend, FiLock, FiFileText, FiAlertCircle, FiMessageSquare } from 'react-icons/fi'
import toast from 'react-hot-toast'

export interface Note {
  id: string
  content: string
  type: 'GENERAL' | 'COMPLAINT' | 'FEEDBACK' | 'INTERNAL'
  isPrivate: boolean
  createdByName: string | null
  createdByEmail: string | null
  createdAt: string
  updatedAt: string
}

interface CustomerNotesProps {
  notes: Note[]
  loading?: boolean
  onAdd: (note: { content: string; type: string; isPrivate: boolean }) => Promise<void>
}

const noteTypeConfig = {
  GENERAL: { icon: FiFileText, color: 'text-gray-600', bg: 'bg-gray-100', label: 'General' },
  COMPLAINT: { icon: FiAlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Complaint' },
  FEEDBACK: { icon: FiMessageSquare, color: 'text-green-600', bg: 'bg-green-100', label: 'Feedback' },
  INTERNAL: { icon: FiLock, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Internal' },
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CustomerNotes({ notes, loading, onAdd }: CustomerNotesProps) {
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState<string>('GENERAL')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim()) {
      toast.error('Please enter a note')
      return
    }

    setIsSubmitting(true)
    try {
      await onAdd({ content: newNote.trim(), type: noteType, isPrivate })
      setNewNote('')
      setNoteType('GENERAL')
      setIsPrivate(false)
      toast.success('Note added successfully')
    } catch {
      toast.error('Failed to add note')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Customer Notes</h3>
            <p className="text-sm text-gray-500">{notes.length} notes</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Add a Note</label>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note about this customer..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white text-sm"
            >
              {Object.entries(noteTypeConfig).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <FiLock className="w-3 h-3" />
                Private
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!newNote.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSend className="w-4 h-4" />
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </form>

      <div className="max-h-96 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <FiFileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-900">No notes yet</p>
            <p className="text-sm text-gray-500 mt-1">Add a note to track important information</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notes.map((note) => {
              const config = noteTypeConfig[note.type as keyof typeof noteTypeConfig] || noteTypeConfig.GENERAL
              const Icon = config.icon

              return (
                <div key={note.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        {note.isPrivate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-600">
                            <FiLock className="w-3 h-3" />
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>{note.createdByName || note.createdByEmail || 'System'}</span>
                        <span>•</span>
                        <span>{formatDate(note.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
