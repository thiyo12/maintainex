import { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert, Animated, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useColors } from '../../lib/ThemeContext'

interface Props {
  visible: boolean
  onClose: () => void
  onConfirm: (data: BookingFormData) => void
  serviceName: string
  basePrice?: number
}

export interface BookingFormData {
  date: string
  timeSlot: string
  address: string
  notes: string
}

const TIME_SLOTS = [
  '08:00-10:00', '10:00-12:00', '12:00-14:00',
  '14:00-16:00', '16:00-18:00', '18:00-20:00',
]

const SCREEN_HEIGHT = Dimensions.get('window').height

export default function BookingSheet({ visible, onClose, onConfirm, serviceName, basePrice }: Props) {
  const colors = useColors()
  const { t } = useTranslation()
  const styles = makeStyles(colors)
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [timeSlot, setTimeSlot] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SCREEN_HEIGHT)
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start()
    }
  }, [visible])

  const canConfirm = date && timeSlot && address.trim().length > 0

  const handleConfirm = () => {
    if (!canConfirm) {
      Alert.alert(t('errors.fillAllFields'), t('errors.fillAllFields'))
      return
    }
    onConfirm({ date, timeSlot, address: address.trim(), notes: notes.trim() })
  }

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: colors.white, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <Text style={[styles.title, { color: colors.ink }]}>{t('components.bookNow')} {serviceName}</Text>
            {basePrice ? (
              <Text style={[styles.price, { color: colors.amberDark }]}>
                LKR {basePrice.toLocaleString()}
              </Text>
            ) : null}

            <Text style={[styles.label, { color: colors.muted }]}>{t('components.selectDate')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
              value={date}
              onChangeText={setDate}
              placeholder={t('booking.datePlaceholder')}
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.label, { color: colors.muted }]}>{t('components.selectTime')}</Text>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.timeChip,
                    timeSlot === slot && { backgroundColor: colors.amberBg, borderColor: colors.amber },
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  onPress={() => setTimeSlot(slot)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.timeText, timeSlot === slot && { color: colors.amberDark, fontFamily: 'Outfit_700Bold' }, { color: colors.ink }]}>
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.muted }]}>{t('profile.address')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t('booking.addressPlaceholder')}
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.label, { color: colors.muted }]}>{t('booking.notesOptional')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.ink }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('booking.specialInstructions')}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: canConfirm ? colors.amber : colors.border }]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={canConfirm ? '#111827' : colors.muted} />
              <Text style={[styles.confirmText, { color: canConfirm ? '#111827' : colors.muted }]}>
                {t('booking.confirm')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Outfit_900Black',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  price: {
    fontSize: 20,
    fontFamily: 'Outfit_900Black',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  confirmBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
  },
  confirmText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
})
