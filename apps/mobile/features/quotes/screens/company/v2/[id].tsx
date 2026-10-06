import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CaretLeft, CheckCircle, Clock, ShieldCheck } from 'phosphor-react-native'
import { getActiveCompanyId } from '@/api/companies'
import { v2Jobs } from '@/api/v2-jobs'
import { v2Quotes } from '@/api/v2-quotes'
import { v3 } from '@/theme/v3/tokens'

export default function CompanySubmitQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [eta, setEta] = useState('')
  const [message, setMessage] = useState('')
  const [existingQuoteId, setExistingQuoteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [jobRes, activeCompanyId] = await Promise.all([v2Jobs.get(id), getActiveCompanyId()])
        setJob(jobRes.job)
        setCompanyId(activeCompanyId)

        const currentQuote = (jobRes.job.quotes || []).find(
          quote => quote.providerType === 'COMPANY' && quote.status === 'PENDING'
        )
        if (currentQuote) {
          setExistingQuoteId(currentQuote.id)
          setPrice(String(currentQuote.price))
          setEta(currentQuote.estimatedCompletionTime || '')
          setMessage(currentQuote.message || '')
        } else {
          setExistingQuoteId(null)
        }
      } catch {
        Alert.alert('Unable to open job', 'This job is no longer available.', [{ text: 'Back', onPress: () => router.back() }])
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const submit = async () => {
    const numeric = Number(price)
    if (!companyId) {
      Alert.alert('Company profile required', 'Complete your company profile before sending quotes.')
      return
    }
    if (!numeric || numeric <= 0 || !eta.trim()) {
      Alert.alert('Complete your quote', 'Enter your price and expected arrival/completion time.')
      return
    }
    setSubmitting(true)
    try {
      if (existingQuoteId) {
        await v2Quotes.revise(existingQuoteId, {
          price: numeric,
          estimatedCompletionTime: eta.trim(),
          message: message.trim(),
          revisionReason: 'Updated after customer discussion',
          companyId,
        })
        Alert.alert('Quote updated', 'The revised company price is now the active offer.', [
          { text: 'View company jobs', onPress: () => router.replace('/(company)/jobs/v2/my-quotes' as any) },
        ])
      } else {
        await v2Quotes.submit({
          jobId: id,
          providerType: 'COMPANY',
          companyId,
          price: numeric,
          estimatedCompletionTime: eta.trim(),
          message: message.trim(),
        })
        Alert.alert('Quote sent', 'The customer can now compare your company offer with other providers.', [
          { text: 'View company jobs', onPress: () => router.replace('/(company)/jobs/v2/my-quotes' as any) },
        ])
      }
    } catch (error: any) {
      Alert.alert('Unable to send quote', error?.message || 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={v3.colors.ink} /></View></SafeAreaView>
  if (!job) return null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><CaretLeft size={18} color={v3.colors.ink} weight="bold" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{existingQuoteId ? 'Update company quote' : 'Company quote'}</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.jobCard}>
          <View style={styles.jobBadge}><Text style={styles.jobBadgeText}>MATCHED JOB</Text></View>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobText}>{job.description}</Text>
          <Text style={styles.jobBudget}>{job.budgetAmount ? `Customer budget · LKR ${Number(job.budgetAmount).toLocaleString()}` : 'Customer requested quotes'}</Text>
        </View>

        <View style={styles.providerCard}>
          <ShieldCheck size={20} color={v3.colors.success} weight="fill" />
          <View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.providerTitle}>Sending as your company</Text><Text style={styles.providerText}>The customer will see the company profile, rating and verification.</Text></View>
        </View>

        <Text style={styles.sectionTitle}>{existingQuoteId ? 'Revise your offer' : 'Your offer'}</Text>
        {existingQuoteId ? (
          <Text style={styles.revisionNote}>Use chat to agree the scope, then publish the final price here. The previous quote is replaced.</Text>
        ) : null}
        <Text style={styles.label}>Price (LKR)</Text>
        <View style={styles.priceWrap}><Text style={styles.currency}>LKR</Text><TextInput style={styles.priceInput} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0" placeholderTextColor={v3.colors.textPlaceholder} /></View>

        <Text style={styles.label}>Arrival / completion estimate</Text>
        <View style={styles.inputWithIcon}><Clock size={17} color={v3.colors.textMuted} /><TextInput style={styles.flexInput} value={eta} onChangeText={setEta} placeholder="e.g. Today 4 PM · 2 hours work" placeholderTextColor={v3.colors.textPlaceholder} /></View>

        <Text style={styles.label}>Message to customer</Text>
        <TextInput style={styles.textArea} value={message} onChangeText={setMessage} multiline textAlignVertical="top" placeholder="Explain what is included, materials, warranty or inspection details." placeholderTextColor={v3.colors.textPlaceholder} />

        <View style={styles.tip}>
          <CheckCircle size={17} color={v3.colors.success} weight="fill" />
          <Text style={styles.tipText}>Clear scope + realistic ETA helps customers compare quotes confidently.</Text>
        </View>

        <TouchableOpacity style={[styles.submit, submitting && { opacity: 0.55 }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator size="small" color={v3.colors.paper} /> : <Text style={styles.submitText}>{existingQuoteId ? 'Update company quote' : 'Send company quote'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: v3.colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: v3.colors.paper, borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...v3.typography.title, color: v3.colors.ink },
  content: { padding: 18, paddingTop: 4, paddingBottom: 36 },
  jobCard: { backgroundColor: v3.colors.ink, borderRadius: 22, padding: 18 },
  jobBadge: { alignSelf: 'flex-start', backgroundColor: v3.colors.amber, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  jobBadgeText: { ...v3.typography.smallBold, color: v3.colors.ink },
  jobTitle: { ...v3.typography.h5, color: v3.colors.paper, marginTop: 12 },
  jobText: { ...v3.typography.caption, color: v3.colors.textLight, lineHeight: 18, marginTop: 5 },
  jobBudget: { ...v3.typography.captionBold, color: v3.colors.amber, marginTop: 13 },
  providerCard: { flexDirection: 'row', backgroundColor: v3.colors.successSoft, borderRadius: 17, padding: 14, marginTop: 10, alignItems: 'flex-start' },
  providerTitle: { ...v3.typography.bodyBold, color: v3.colors.ink },
  providerText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 16, marginTop: 2 },
  sectionTitle: { ...v3.typography.title, color: v3.colors.ink, marginTop: 22, marginBottom: 2 },
  revisionNote: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 17, marginTop: 4, marginBottom: 4 },
  label: { ...v3.typography.captionBold, color: v3.colors.textSecondary, marginTop: 13, marginBottom: 6 },
  priceWrap: { height: 58, backgroundColor: v3.colors.paper, borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  currency: { ...v3.typography.bodyBold, color: v3.colors.textMuted, marginRight: 10 },
  priceInput: { flex: 1, fontFamily: 'Outfit_800ExtraBold', fontSize: 22, color: v3.colors.ink },
  inputWithIcon: { height: 54, backgroundColor: v3.colors.paper, borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  flexInput: { flex: 1, marginLeft: 8, fontFamily: 'Outfit_500Medium', fontSize: 13, color: v3.colors.ink },
  textArea: { minHeight: 112, backgroundColor: v3.colors.paper, borderRadius: 16, borderWidth: 1, borderColor: v3.colors.line, padding: 14, fontFamily: 'Outfit_500Medium', fontSize: 13, color: v3.colors.ink },
  tip: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: v3.colors.paper, borderRadius: 15, borderWidth: 1, borderColor: v3.colors.line, padding: 12, marginTop: 12 },
  tipText: { ...v3.typography.caption, color: v3.colors.textSecondary, lineHeight: 16, marginLeft: 8, flex: 1 },
  submit: { height: 55, borderRadius: 16, backgroundColor: v3.colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  submitText: { ...v3.typography.bodyLarge, color: v3.colors.paper },
})
