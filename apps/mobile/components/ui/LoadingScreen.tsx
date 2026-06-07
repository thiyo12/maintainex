import { View, ActivityIndicator, StyleSheet, Text } from 'react-native'
import { useColors } from '../../lib/ThemeContext'
import { fonts, fontSizes } from '../../lib/fonts'
import { spacing } from '../../lib/tokens'

export function LoadingScreen() {
  const colors = useColors()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.muted }]}>Loading...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: spacing.lg,
    fontSize: fontSizes.bodySmall,
    fontFamily: fonts.body,
  },
})
