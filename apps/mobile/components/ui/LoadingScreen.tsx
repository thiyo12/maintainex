import { View, StyleSheet } from 'react-native'

interface Props { onDone?: () => void }

export function LoadingScreen({ onDone }: Props) {
  return <View style={s.container} />
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
})
