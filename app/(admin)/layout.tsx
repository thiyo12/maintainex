import AdminLayout from '@/components/admin/AdminLayout'

export default function WebAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
}
