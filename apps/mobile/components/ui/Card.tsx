import { type ReactNode } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  children: ReactNode
  variant?: 'default' | 'elevated' | 'pressable'
  onPress?: () => void
  style?: any
  padded?: boolean
}

export default function Card({ children, variant = 'default', onPress, style, padded }: Props) {
  const colors = useColors()
    const styles = makeStyles(colors)

  const cardStyle = [
    styles.card,
    { backgroundColor: colors.white },
    padded === false && { padding: 0 },
    style,
  ]

  if (variant === 'pressable' && onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={cardStyle}>
        {children}
      </TouchableOpacity>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

const makeStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
})
