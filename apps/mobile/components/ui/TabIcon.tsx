import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import { Icon } from 'phosphor-react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

interface Props {
  icon: Icon
  focused: boolean
  activeColor?: string
  inactiveColor?: string
  badge?: number
}

export default function TabIcon({
  icon: IconComponent,
  focused,
  activeColor = '#F5A623',
  inactiveColor = '#6F6B6B',
  badge = 0,
}: Props) {
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withSpring(focused ? 1.18 : 1, { damping: 20, stiffness: 300 })
  }, [focused, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={animatedStyle}>
        <IconComponent
          size={24}
          color={focused ? activeColor : inactiveColor}
          weight={focused ? 'fill' : 'regular'}
        />
      </Animated.View>
      {focused ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: activeColor, marginTop: 3 }} /> : null}
      {badge > 0 ? (
        <View style={{
          position: 'absolute',
          top: -3,
          right: -10,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#E11900',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 4,
        }}>
          <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#FFFFFF' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </View>
  )
}
