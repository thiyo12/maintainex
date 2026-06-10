import { Image } from 'react-native'

interface Props {
  size?: number
}

export default function Logo({ size = 80 }: Props) {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={{ width: size, height: size, borderRadius: size / 2, resizeMode: 'cover' }}
    />
  )
}
