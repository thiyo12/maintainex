import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import InboxList from '../../components/chat/InboxList'
import { fonts } from '../../lib/fonts'

export default function ChatListScreen() {
  const { t } = useTranslation()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('chat.title')}</Text>
      </View>
      <InboxList />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 28, fontFamily: fonts.heading, color: '#FFFFFF' },
})
