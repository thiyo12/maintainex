import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

type Status =
  | 'OPEN'
  | 'QUOTE_ACCEPTED'
  | 'PENDING_PAYMENT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ESCROW_DEPOSITED'
  | 'FAILED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'WORKING'
  | 'REVIEW'
  | string

const META: Record<string, { i18nKey?: string; text?: string; bg: string; fg: string }> = {
  OPEN: { i18nKey: 'jobs.status.open', fg: '#FFFFFF', bg: '#2E2E2E' },
  QUOTE_ACCEPTED: { i18nKey: 'jobs.status.accepted', fg: '#F5A623', bg: '#FDE8B3' },
  PENDING_PAYMENT: { text: 'Payment Pending', fg: '#3B82F6', bg: '#3B82F618' },
  IN_PROGRESS: { i18nKey: 'jobs.status.inProgress', fg: '#3B82F6', bg: '#3B82F618' },
  COMPLETED: { i18nKey: 'jobs.status.completed', fg: '#22C55E', bg: '#0A2E1A' },
  CANCELLED: { i18nKey: 'jobs.status.cancelled', fg: '#B3B3B3', bg: '#2E2E2E' },
  ESCROW_DEPOSITED: { text: 'Funded', fg: '#3B82F6', bg: '#3B82F618' },
  FAILED: { i18nKey: 'jobs.status.cancelled', fg: '#EF4444', bg: '#2E0A0A' },
  EN_ROUTE: { text: 'On the way', fg: '#F5A623', bg: '#FDE8B3' },
  ARRIVED: { text: 'Arrived', fg: '#F5A623', bg: '#FDE8B3' },
  WORKING: { text: 'Working', fg: '#F5A623', bg: '#FDE8B3' },
  REVIEW: { text: 'In Review', fg: '#3B82F6', bg: '#3B82F618' },
}

interface Props {
  status: Status
  label?: string
}

export default function StatusBadge({ status, label }: Props) {
  const { t } = useTranslation()
  const meta = META[status?.toUpperCase?.()] || { fg: '#B3B3B3', bg: '#2E2E2E' }
  const text =
    label ||
    (meta.i18nKey ? t(meta.i18nKey) : meta.text) ||
    status?.toLowerCase()?.replace(/_/g, ' ') ||
    ''

  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <View style={[styles.dot, { backgroundColor: meta.fg }]} />
      <Text style={[styles.text, { color: meta.fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: '#FFFFFF' },
})
