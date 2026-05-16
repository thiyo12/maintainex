import { View, ActivityIndicator, StyleSheet } from 'react-native'

const colors = {
  primary: '#F59E0B',
  dark: '#1A1A2E',
  background: '#F9FAFB',
}

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
})
