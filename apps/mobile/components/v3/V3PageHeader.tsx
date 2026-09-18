import { ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ArrowLeft } from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { v3 } from '../../theme/v3/tokens'

type Props = {
  title: string
  subtitle?: string
  right?: ReactNode
  showBack?: boolean
}

export default function V3PageHeader({ title, subtitle, right, showBack = true }: Props) {
  const router = useRouter()
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.72} style={styles.back}>
            <ArrowLeft size={19} color={v3.colors.ink} weight="bold" />
          </TouchableOpacity>
        ) : <View style={styles.backSpacer} />}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 },
  topRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center' },
  back: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: v3.colors.paper,
    borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center',
  },
  backSpacer: { width: 40, height: 40 },
  titleWrap: { flex: 1, paddingHorizontal: 12 },
  title: { fontFamily: 'Outfit_900Black', fontSize: 24, color: v3.colors.ink, letterSpacing: -0.3 },
  subtitle: { fontFamily: 'Outfit_500Medium', fontSize: 11, lineHeight: 15, color: v3.colors.textSecondary, marginTop: 2 },
  right: { minWidth: 40, alignItems: 'flex-end' },
})
