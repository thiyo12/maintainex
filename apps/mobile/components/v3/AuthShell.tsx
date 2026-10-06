import { ReactNode } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { v3 } from '../../theme/v3/tokens'

interface Props {
  children: ReactNode
  bg?: string
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
}

export default function AuthShell({ children, bg = v3.colors.canvas, edges = ['top', 'bottom'] }: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={edges}>
      <KeyboardAvoidingView
        style={styles.kb}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.container, { backgroundColor: bg }]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kb: { flex: 1 },
  container: { flex: 1 },
})
