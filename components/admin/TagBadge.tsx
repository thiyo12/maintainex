'use client'

import { FiX } from 'react-icons/fi'
import { clsx } from 'clsx'

interface TagBadgeProps {
  tag: {
    id: string
    name: string
    color: string
    slug?: string
  }
  onRemove?: (tag: { id: string; name: string; color: string; slug?: string }) => void
  size?: 'sm' | 'md'
  clickable?: boolean
  onClick?: () => void
}

const defaultColors: Record<string, { bg: string; text: string }> = {
  '#6366f1': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  '#8b5cf6': { bg: 'bg-purple-100', text: 'text-purple-700' },
  '#ec4899': { bg: 'bg-pink-100', text: 'text-pink-700' },
  '#ef4444': { bg: 'bg-red-100', text: 'text-red-700' },
  '#f97316': { bg: 'bg-orange-100', text: 'text-orange-700' },
  '#f59e0b': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  '#84cc16': { bg: 'bg-lime-100', text: 'text-lime-700' },
  '#22c55e': { bg: 'bg-green-100', text: 'text-green-700' },
  '#14b8a6': { bg: 'bg-teal-100', text: 'text-teal-700' },
  '#06b6d4': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  '#0ea5e9': { bg: 'bg-sky-100', text: 'text-sky-700' },
  '#3b82f6': { bg: 'bg-blue-100', text: 'text-blue-700' },
}

export default function TagBadge({ tag, onRemove, size = 'md', clickable = false, onClick }: TagBadgeProps) {
  const colorConfig = defaultColors[tag.color] || { bg: 'bg-gray-100', text: 'text-gray-700' }

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  }

  const IconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  const handleClick = (e: React.MouseEvent) => {
    if (clickable && onClick) {
      e.stopPropagation()
      onClick()
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove?.(tag)
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
        colorConfig.bg,
        colorConfig.text,
        sizeClasses[size],
        clickable && 'cursor-pointer hover:opacity-80',
        onRemove && 'pr-1'
      )}
      onClick={handleClick}
      style={{ backgroundColor: `${tag.color}15` }}
    >
      <span
        className={clsx('w-2 h-2 rounded-full', clickable ? 'animate-pulse' : '')}
        style={{ backgroundColor: tag.color }}
      />
      {tag.name}
      {onRemove && (
        <button
          onClick={handleRemove}
          className={clsx(
            'ml-0.5 rounded-full hover:bg-black/10 transition-colors flex items-center justify-center',
            IconSize
          )}
        >
          <FiX />
        </button>
      )}
    </span>
  )
}

interface TagListProps {
  tags: Array<{
    id: string
    name: string
    color: string
    slug?: string
  }>
  size?: 'sm' | 'md'
  onRemove?: (tag: { id: string; name: string; color: string; slug?: string }) => void
}

export function TagList({ tags, size = 'md', onRemove }: TagListProps) {
  if (!tags || tags.length === 0) {
    return (
      <span className="text-sm text-gray-400 italic">No tags</span>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} size={size} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface TagSelectProps {
  availableTags: Array<{
    id: string
    name: string
    color: string
    slug?: string
  }>
  selectedTags: string[]
  onChange: (tagIds: string[]) => void
}

export function TagSelect({ availableTags, selectedTags, onChange }: TagSelectProps) {
  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTags, tagId])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {availableTags.map((tag) => {
        const isSelected = selectedTags.includes(tag.id)
        return (
          <TagBadge
            key={tag.id}
            tag={tag}
            size="sm"
            clickable
            onClick={() => toggleTag(tag.id)}
          />
        )
      })}
    </div>
  )
}
