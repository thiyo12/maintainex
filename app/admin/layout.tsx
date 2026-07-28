import { AdminErrorBoundary } from '@/components/admin/ErrorBoundary'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminErrorBoundary>
      {children}
    </AdminErrorBoundary>
  )
}
