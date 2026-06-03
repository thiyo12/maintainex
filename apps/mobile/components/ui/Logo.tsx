import { View, StyleSheet } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

interface Props {
  size?: number
}

export default function Logo({ size = 80 }: Props) {
  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Bright yellow background circle */}
        <Circle cx="50" cy="50" r="48" fill="#FFD700" />

        {/* Top arc of ring */}
        <Path
          d="M 12,36 A 40,40 0 1,1 88,36"
          fill="none"
          stroke="#0F0A00"
          strokeWidth={7}
          strokeLinecap="round"
        />

        {/* Bottom arc of ring */}
        <Path
          d="M 88,64 A 40,40 0 1,1 12,64"
          fill="none"
          stroke="#0F0A00"
          strokeWidth={7}
          strokeLinecap="round"
        />

        {/* M — bold angular letter */}
        <Path
          d="M 24,32 L 24,68 L 38,32 L 50,68 L 50,32"
          fill="none"
          stroke="#0F0A00"
          strokeWidth={5.5}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* X — bold angular letter */}
        <Path
          d="M 58,32 L 78,68 M 78,32 L 58,68"
          fill="none"
          stroke="#0F0A00"
          strokeWidth={5.5}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
