import { type ReactNode } from 'react'
import { SafeAreaView, StyleSheet, Platform, StatusBar, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '../../lib/ThemeContext'
import { spacing } from '../../lib/tokens'

interface Props {
  children: ReactNode
  withGradient?: boolean
  noPadding?: boolean
}

export default function SafeContainer({ children, withGradient = false, noPadding = false }: Props) {
  const colors = useColors()
    const styles = makeStyles(colors)

  const content = (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {Platform.OS === 'android' && <StatusBar barStyle="dark-content" backgroundColor={colors.background} />}
      <View
        style={[
          styles.inner,
          !noPadding && { paddingHorizontal: spacing.lg },
          { maxWidth: 1200, alignSelf: 'center', width: '100%', flex: 1 },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  )

  if (withGradient) {
    return (
      <LinearGradient colors={[colors.primaryLight, colors.background]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.3 }} style={styles.gradient}>
        {content}
      </LinearGradient>
    )
  }

  return content
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  inner: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
})
