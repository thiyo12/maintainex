import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../../lib/ThemeContext'
import InboxList from '../../../components/chat/InboxList'

export default function CompanyInbox() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)
  const [unread, setUnread] = useState(0)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>{t('company.inbox')}</Text>
          {unread > 0 ? (
            <View style={styles.headingBadge}>
              <Text style={styles.headingBadgeText}>{unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <InboxList onTotalUnread={setUnread} />
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.ink },
  headingBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.companyAccent,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  headingBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
})