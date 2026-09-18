import { StyleSheet, Text, TextInput, View } from 'react-native'
import { MapPin } from 'phosphor-react-native'
import { v3 } from '../../theme/v3/tokens'
import type { JobLocationValue } from './JobLocationPicker.native'

type Props = {
  value: JobLocationValue
  onChange: (value: JobLocationValue) => void
}

export default function JobLocationPicker({ value, onChange }: Props) {
  return (
    <View>
      <View style={styles.mapFallback}>
        <MapPin size={28} color={v3.colors.ink} weight="fill" />
        <Text style={styles.title}>Choose the job location</Text>
        <Text style={styles.body}>Interactive pin selection is available in the iOS and Android app.</Text>
      </View>
      <TextInput
        value={value.label}
        onChangeText={(label) => onChange({ ...value, label })}
        placeholder="Area, street or landmark"
        placeholderTextColor={v3.colors.textPlaceholder}
        style={styles.input}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  mapFallback: {
    minHeight: 160, borderRadius: 18, backgroundColor: v3.colors.amberSoft,
    borderWidth: 1, borderColor: v3.colors.line, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  title: { fontFamily: 'Outfit_800ExtraBold', fontSize: 16, color: v3.colors.ink, marginTop: 8 },
  body: { fontFamily: 'Outfit_400Regular', fontSize: 11.5, lineHeight: 16, color: v3.colors.textSecondary, textAlign: 'center', marginTop: 4 },
  input: {
    height: 50, marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: v3.colors.line,
    backgroundColor: v3.colors.paper, paddingHorizontal: 14, fontFamily: 'Outfit_500Medium', fontSize: 12, color: v3.colors.ink,
  },
})
