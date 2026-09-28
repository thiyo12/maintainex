import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useColors } from '@/lib/ThemeContext'
import InboxList from '@/components/chat/InboxList'

export default function ChatListScreen() {
  const { t } = useTranslation()
  const colors = useColors()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>{t('chat.title')}</Text>
      </View>
      <InboxList />
    </SafeAreaView>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.dark },
})