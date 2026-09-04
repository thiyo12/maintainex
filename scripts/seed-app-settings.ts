import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULTS = [
  // Matching algorithm
  { key: 'matching.radius_km', value: '50', type: 'number', label: 'Match radius (km)', description: 'Max distance for on-site job notifications', groupName: 'matching' },
  { key: 'matching.max_notify_wave1', value: '3', type: 'number', label: 'Wave 1 notify count', description: 'How many taskers to notify first', groupName: 'matching' },
  { key: 'matching.max_notify_wave2', value: '4', type: 'number', label: 'Wave 2 notify count', description: 'How many additional taskers after wave 1', groupName: 'matching' },
  { key: 'matching.max_notify_wave3', value: '3', type: 'number', label: 'Wave 3 notify count', description: 'Final wave if still no accept', groupName: 'matching' },
  { key: 'matching.wave1_wait_min', value: '15', type: 'number', label: 'Wave 1 wait (min)', description: 'Minutes to wait before sending wave 2', groupName: 'matching' },
  { key: 'matching.wave2_wait_min', value: '15', type: 'number', label: 'Wave 2 wait (min)', description: 'Minutes to wait before sending wave 3', groupName: 'matching' },
  { key: 'matching.wave3_wait_min', value: '15', type: 'number', label: 'Wave 3 wait (min)', description: 'Minutes before notifying customer of no match', groupName: 'matching' },
  { key: 'matching.max_active_jobs', value: '3', type: 'number', label: 'Max active jobs per tasker', description: 'Tasker excluded from matching if at this limit', groupName: 'matching' },
  { key: 'matching.response_hours', value: '2', type: 'number', label: 'Customer response window (hours)', description: 'Hours a job waits for tasker responses before auto-escalation to admin', groupName: 'matching' },

  // Score weights
  { key: 'score.weight_rating', value: '35', type: 'number', label: 'Rating weight (%)', description: 'How much rating affects match score', groupName: 'scoring' },
  { key: 'score.weight_distance', value: '30', type: 'number', label: 'Distance weight (%)', description: 'How much distance affects match score', groupName: 'scoring' },
  { key: 'score.weight_completion', value: '20', type: 'number', label: 'Completion rate weight (%)', description: 'How much job completion rate affects score', groupName: 'scoring' },
  { key: 'score.weight_speed', value: '10', type: 'number', label: 'Response speed weight (%)', description: 'How much reply speed affects score', groupName: 'scoring' },
  { key: 'score.weight_activity', value: '5', type: 'number', label: 'Activity weight (%)', description: 'How much recent activity affects score', groupName: 'scoring' },

  // Offer program
  { key: 'offer.accept_timeout_min', value: '15', type: 'number', label: 'Offer accept timeout (min)', description: 'How long tasker has to accept an offer booking', groupName: 'offer' },
  { key: 'offer.max_decline_before_depriority', value: '3', type: 'number', label: 'Max declines before depriority', description: 'Times tasker can decline before losing queue priority', groupName: 'offer' },

  // Escrow
  { key: 'escrow.auto_release_hours', value: '48', type: 'number', label: 'Auto-release after (hours)', description: 'Hours after job marked complete before auto-release', groupName: 'escrow' },
  { key: 'escrow.reminder_hours', value: '36,24,12', type: 'string', label: 'Reminder notification hours', description: 'Comma-separated hours before auto-release to send reminders', groupName: 'escrow' },
  { key: 'escrow.platform_fee_percent', value: '8', type: 'number', label: 'Platform fee (%)', description: 'Percentage taken from every completed job', groupName: 'escrow' },
  { key: 'escrow.min_payout_lkr', value: '500', type: 'number', label: 'Minimum payout (LKR)', description: 'Minimum amount tasker can withdraw', groupName: 'escrow' },
  { key: 'escrow.payout_days', value: '1', type: 'number', label: 'Payout processing days', description: 'Business days to process payout requests', groupName: 'escrow' },

  // Reputation
  { key: 'reputation.cancel_penalty_pts', value: '5', type: 'number', label: 'Cancel penalty points', description: 'Score points deducted per cancellation', groupName: 'reputation' },
  { key: 'reputation.noshow_penalty_pts', value: '3', type: 'number', label: 'No-show penalty points', description: 'Score points deducted per no-show', groupName: 'reputation' },
  { key: 'reputation.warn_cancel_count', value: '3', type: 'number', label: 'Warning threshold (cancels)', description: 'Cancellations in 30 days before warning sent', groupName: 'reputation' },
  { key: 'reputation.suspend_cancel_count', value: '5', type: 'number', label: 'Suspend threshold (cancels)', description: 'Cancellations in 30 days before auto-suspend', groupName: 'reputation' },
  { key: 'reputation.suspend_days', value: '7', type: 'number', label: 'Suspension duration (days)', description: 'Days account suspended after threshold hit', groupName: 'reputation' },
  { key: 'reputation.top_pro_min_jobs', value: '50', type: 'number', label: 'Top Pro min jobs', description: 'Minimum completed jobs for Top Pro badge', groupName: 'reputation' },
  { key: 'reputation.top_pro_min_rating', value: '4.8', type: 'number', label: 'Top Pro min rating', description: 'Minimum rating for Top Pro badge', groupName: 'reputation' },

  // Fraud
  { key: 'fraud.max_disputes_percent', value: '30', type: 'number', label: 'Max dispute rate (%)', description: 'Customer dispute % before flagging for review', groupName: 'fraud' },
  { key: 'fraud.max_chargebacks_90d', value: '2', type: 'number', label: 'Max chargebacks (90 days)', description: 'Chargebacks before account freeze', groupName: 'fraud' },
  { key: 'fraud.max_accounts_per_device', value: '3', type: 'number', label: 'Max accounts per device', description: 'Accounts on same device before block', groupName: 'fraud' },

  // Notifications
  { key: 'notify.reengagement_hours', value: '24', type: 'number', label: 'Re-engagement delay (hours)', description: 'Hours before notifying customer about unquoted job', groupName: 'notifications' },
]

async function main() {
  console.log('Seeding app_settings...')

  for (const setting of DEFAULTS) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }

  console.log(`Seeded ${DEFAULTS.length} app_settings records`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
