import { View, StyleSheet } from 'react-native'
import { Ticket } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { colors } from '../../../lib/design'
import EmptyState from '../../../components/ui/EmptyState'

export default function VouchersScreen() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <EmptyState
        title={t('vouchers.emptyTitle')}
        subtitle={t('vouchers.emptySub')}
        FallbackIcon={Ticket}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
})