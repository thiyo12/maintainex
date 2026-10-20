import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { v2Request } from '@/api/v2-client'
import { v3 } from '@/theme/v3/tokens'

interface CrewWorker {
  assignmentId: string
  crewSlot: number
  crewRole: string
  status: string
  displayName: string | null
  verifiedPhotoUrl: string | null
  photoReady: boolean
  customerConfirmed: boolean
}

interface CrewPhotoPreview {
  crew: {
    id: string
    status: string
    version: number
    requiredWorkersCount?: number
  } | null
  workers: CrewWorker[]
  allConfirmed: boolean
  dispatchEnabled: false
  workStartEnabled: false
}

export default function CustomerCrewIdentityPanel({ jobId }: { jobId: string }) {
  const [preview, setPreview] = useState<CrewPhotoPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const result = await v2Request<CrewPhotoPreview>(
        `/api/mobile/v2/jobs/${encodeURIComponent(jobId)}/crew-identity`,
      )
      setPreview(result)
    } catch (e: any) {
      setPreview(null)
      setError(e?.message || 'Crew details are temporarily unavailable')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { void refresh() }, [refresh])

  const submit = async (worker: CrewWorker, decision: 'MATCH' | 'MISMATCH') => {
    const crew = preview?.crew
    if (!crew || sending || worker.status !== 'CREW_ACCEPTED') return
    setSending(worker.assignmentId)
    try {
      await v2Request(`/api/mobile/v2/jobs/${encodeURIComponent(jobId)}/crew-identity`, {
        method: 'POST',
        body: JSON.stringify({
          crewDispatchId: crew.id,
          assignmentId: worker.assignmentId,
          expectedVersion: crew.version,
          decision,
        }),
      })
      await refresh()
      Alert.alert(
        decision === 'MISMATCH' ? 'Crew blocked for safety review' : 'Worker photo confirmed',
        decision === 'MISMATCH'
          ? 'All staged worker reservations were released. Contact support before allowing anyone to work.'
          : 'Your confirmation was recorded. Work start and arrival PINs remain disabled.',
      )
    } catch (e: any) {
      Alert.alert('Unable to confirm crew member', e?.message || 'Please refresh and try again.')
      await refresh()
    } finally {
      setSending(null)
    }
  }

  const reportMismatch = (worker: CrewWorker) => Alert.alert(
    'Report the wrong worker?',
    'This blocks the entire crew and creates a safety review. Do not share any arrival PIN.',
    [
      { text: 'Go back', style: 'cancel' },
      { text: 'Report mismatch', style: 'destructive',
        onPress: () => { void submit(worker, 'MISMATCH') } },
    ],
  )

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Verify every crew member</Text>
      <Text style={styles.subheading}>
        Compare each approved photo with the person who will arrive. Confirm
        individuals separately. A crew invitation is not permission to begin work.
      </Text>
      {loading ? <ActivityIndicator color={v3.colors.ink} /> : null}
      {error ? (
        <TouchableOpacity onPress={() => { setLoading(true); void refresh() }}>
          <Text style={styles.warning}>{error} · Tap to retry</Text>
        </TouchableOpacity>
      ) : null}
      {preview?.crew && preview.crew.status !== 'FORMING' ? (
        <Text style={styles.warning}>
          Crew status: {preview.crew.status}. Work is not authorized.
        </Text>
      ) : null}
      {preview?.crew?.status === 'FORMING' ? (
        <>
          <Text style={styles.subheading}>
            {preview.workers.filter(w => w.status === 'CREW_ACCEPTED').length}
            {' / '}{preview.crew.requiredWorkersCount || preview.workers.length} worker responses
          </Text>
          {preview.workers.map(worker => (
            <View key={worker.assignmentId} style={styles.worker}>
              <Text style={styles.workerName}>
                {worker.crewRole === 'LEAD' ? 'Crew lead' : 'Crew member'} · Slot {worker.crewSlot}
              </Text>
              {worker.photoReady && worker.verifiedPhotoUrl ? (
                <>
                  <Image source={{ uri: worker.verifiedPhotoUrl }} style={styles.photo} />
                  <Text style={styles.workerName}>{worker.displayName}</Text>
                </>
              ) : (
                <Text style={styles.warning}>
                  {worker.status === 'CREW_ACCEPTED'
                    ? 'Verified photo unavailable — do not authorize work'
                    : 'Awaiting this worker’s acceptance'}
                </Text>
              )}
              {worker.customerConfirmed ? (
                <Text style={styles.confirmed}>Photo confirmed for this crew reservation</Text>
              ) : worker.status === 'CREW_ACCEPTED' ? (
                <View style={styles.actions}>
                  {worker.photoReady ? (
                    <TouchableOpacity style={styles.confirmButton} disabled={!!sending}
                      onPress={() => { void submit(worker, 'MATCH') }}>
                      <Text style={styles.confirmText}>Photo matches</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.reportButton} disabled={!!sending}
                    onPress={() => reportMismatch(worker)}>
                    <Text style={styles.reportText}>Report mismatch</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}
          <Text style={styles.warning}>
            Even when every photo is confirmed, crew dispatch, arrival and Start Work PINs remain disabled.
          </Text>
        </>
      ) : !loading && !error && !preview?.crew ? (
        <Text style={styles.warning}>No staged crew roster exists for this booking yet.</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line,
    padding: 15, marginVertical: 12, backgroundColor: v3.colors.paper, gap: 11 },
  heading: { ...v3.typography.bodyLarge, color: v3.colors.ink },
  subheading: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 19 },
  worker: { borderTopWidth: 1, borderColor: v3.colors.line, paddingTop: 12, gap: 8 },
  workerName: { ...v3.typography.captionBold, color: v3.colors.ink },
  photo: { height: 110, width: 110, borderRadius: 12, backgroundColor: v3.colors.surfaceGray },
  warning: { ...v3.typography.small, color: v3.colors.amberDark, lineHeight: 18 },
  confirmed: { ...v3.typography.captionBold, color: v3.colors.success },
  actions: { flexDirection: 'row', gap: 8 },
  confirmButton: { borderRadius: 11, backgroundColor: v3.colors.ink, padding: 11 },
  confirmText: { ...v3.typography.smallBold, color: v3.colors.paper },
  reportButton: { borderRadius: 11, borderWidth: 1, borderColor: v3.colors.amberDark, padding: 11 },
  reportText: { ...v3.typography.smallBold, color: v3.colors.amberDark },
})
