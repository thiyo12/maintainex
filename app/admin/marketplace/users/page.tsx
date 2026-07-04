'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, flexRender, createColumnHelper,
  type SortingState, type ColumnFiltersState,
} from '@tanstack/react-table'
import { FiSearch, FiEye, FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft, FiChevronRight, FiChevronsRight, FiUsers, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  identityStatus: string
  isActive: boolean
  isBanned: boolean
  country: string | null
  createdAt: string
}

const columnHelper = createColumnHelper<User>()

export default function UsersPage() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users', globalFilter],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/users', {
        params: { search: globalFilter, limit: 1000 },
      })
      return (res.data.data || []) as User[]
    },
  })

  const users = useMemo(() => data || [], [data])

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => info.getValue() || '\u2014',
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => <span className="text-gray-400">{info.getValue()}</span>,
    }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: (info) => (
        <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('country', {
      header: 'Country',
      cell: (info) => <span className="text-gray-400">{info.getValue() || '\u2014'}</span>,
    }),
    columnHelper.accessor('identityStatus', {
      header: 'KYC',
      cell: (info) => {
        const v = info.getValue()
        const colors: Record<string, string> = {
          VERIFIED: 'bg-green-500/20 text-green-400',
          PENDING: 'bg-yellow-500/20 text-yellow-400',
          REJECTED: 'bg-red-500/20 text-red-400',
        }
        return (
          <span className={`text-xs px-2 py-1 rounded font-medium ${colors[v] || 'bg-gray-500/20 text-gray-400'}`}>
            {v === 'NOT_SUBMITTED' ? 'Not Submitted' : v}
          </span>
        )
      },
    }),
    columnHelper.accessor((row) => row.isBanned ? 'Banned' : row.isActive ? 'Active' : 'Suspended', {
      id: 'status',
      header: 'Status',
      cell: (info) => {
        const v = info.getValue()
        const colors: Record<string, string> = {
          Active: 'bg-green-500/20 text-green-400',
          Suspended: 'bg-yellow-500/20 text-yellow-400',
          Banned: 'bg-red-500/20 text-red-400',
        }
        return (
          <span className={`text-xs px-2 py-1 rounded font-medium ${colors[v] || ''}`}>
            {v}
          </span>
        )
      },
    }),
    columnHelper.accessor('createdAt', {
      header: 'Joined',
      cell: (info) => <span className="text-gray-500">{new Date(info.getValue()).toLocaleDateString()}</span>,
    }),
    columnHelper.accessor('id', {
      header: '',
      cell: (info) => (
        <a
          href={`/admin/marketplace/users/${info.getValue()}`}
          className="inline-flex items-center gap-1 text-sm transition-colors"
          style={{ color: '#F59E0B' }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <FiEye size={14} /> View
        </a>
      ),
      enableSorting: false,
    }),
  ], [])

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#F59E0B' }}>Users</h1>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: '#1B1D27', color: '#F59E0B', border: '1px solid #23252F' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#23252F'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1B1D27'}
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          Failed to load users
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
        <div className="p-4 border-b" style={{ borderColor: '#23252F' }}>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search users..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: '#15161E', border: '1px solid #23252F', color: '#FFFFFF' }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b" style={{ borderColor: '#23252F' }}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className={`px-6 py-4 text-left text-sm font-medium text-gray-400 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-white' : ''}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="inline-flex flex-col">
                                <FiChevronUp size={10} className={header.column.getIsSorted() === 'asc' ? 'text-amber-500' : 'text-gray-600'} />
                                <FiChevronDown size={10} className={header.column.getIsSorted() === 'desc' ? 'text-amber-500' : 'text-gray-600'} />
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b transition-colors" style={{ borderColor: '#23252F' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-6 py-4 text-sm text-white">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: '#23252F' }}>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <span className="text-gray-600">|</span>
                <span>
                  {table.getFilteredRowModel().rows.length} total
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}
                  className="p-2 rounded transition-colors disabled:opacity-30 text-gray-400 hover:text-white hover:bg-white/5">
                  <FiChevronsLeft size={16} />
                </button>
                <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                  className="p-2 rounded transition-colors disabled:opacity-30 text-gray-400 hover:text-white hover:bg-white/5">
                  <FiChevronLeft size={16} />
                </button>
                <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                  className="p-2 rounded transition-colors disabled:opacity-30 text-gray-400 hover:text-white hover:bg-white/5">
                  <FiChevronRight size={16} />
                </button>
                <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}
                  className="p-2 rounded transition-colors disabled:opacity-30 text-gray-400 hover:text-white hover:bg-white/5">
                  <FiChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
