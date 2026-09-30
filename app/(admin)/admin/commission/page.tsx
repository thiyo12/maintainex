import { redirect } from 'next/navigation'

export default function LegacyCommissionRedirect() {
  redirect('/admin/financial/commission')
}
