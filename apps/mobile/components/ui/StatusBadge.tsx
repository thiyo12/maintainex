import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, radius, typography } from '../../lib/design'

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
  OPEN: { i18nKey: 'jobs.status.open', fg: colors.textPrimary, bg: colors.surfaceHigh },
  QUOTE_ACCEPTED: { i18nKey: 'jobs.status.accepted', fg: colors.accent, bg: colors.accentSoft },
  PENDING_PAYMENT: { text: 'Payment Pending', fg: colors.info, bg: colors.info + '18' },
  IN_PROGRESS: { i18nKey: 'jobs.status.inProgress', fg: colors.info, bg: colors.info + '18' },
  COMPLETED: { i18nKey: 'jobs.status.completed', fg: colors.success, bg: colors.successSoft },
  CANCELLED: { i18nKey: 'jobs.status.cancelled', fg: colors.textSecondary, bg: colors.surfaceHigh },
  ESCROW_DEPOSITED: { text: 'Funded', fg: colors.info, bg: colors.info + '18' },
  FAILED: { i18nKey: 'jobs.status.cancelled', fg: colors.error, bg: colors.errorSoft },
  EN_ROUTE: { text: 'On the way', fg: colors.accent, bg: colors.accentSoft },
  ARRIVED: { text: 'Arrived', fg: colors.accent, bg: colors.accentSoft },
  WORKING: { text: 'Working', fg: colors.accent, bg: colors.accentSoft },
  REVIEW: { text: 'In Review', fg: colors.info, bg: colors.info + '18' },
}

interface Props {
  status: Status
  label?: string
}

export default function StatusBadge({ status, label }: Props) {
  const { t } = useTranslation()
  const meta = META[status?.toUpperCase?.()] || { fg: colors.textSecondary, bg: colors.surfaceHigh }
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
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...typography.caption, fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary },
})