import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { PencilSimple, Gear, Check, Lightning, Buildings } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useColors } from '../lib/ThemeContext'
import { fonts } from '../lib/fonts'

interface Props {
  initials: string
  name: string
  subtitle?: string
  roleLabel?: string
  nickname?: string
  variant?: 'tasker' | 'company'
  verified?: boolean
  onEdit?: () => void
  onSettings?: () => void
}

export default function ProfileHeader({
  initials, name, subtitle, roleLabel, nickname, variant = 'tasker', verified,
  onEdit, onSettings,
}: Props) {
  const colors = useColors()
  const styles = makeStyles(colors)
  const { t } = useTranslation()
  const isTasker = variant === 'tasker'
  const gradientColors = isTasker
    ? (['#F59E0B', '#FBBF24'] as const)
    : (['#4F46E5', '#818CF8'] as const)

  const RoleIcon = isTasker ? Lightning : Buildings
  const labelParts = (roleLabel || subtitle || '').split('·')
  const roleName = labelParts[0]?.trim() || ''
  const roleLoc = labelParts[1]?.trim() || ''

  return (
    <View>
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
        <View style={styles.coverIcons}>
          {onEdit && (
            <TouchableOpacity style={styles.coverIconBtn} onPress={onEdit}>
              <PencilSimple size={15} color="#fff" weight="bold" />
            </TouchableOpacity>
          )}
          {onSettings && (
            <TouchableOpacity style={styles.coverIconBtn} onPress={onSettings}>
              <Gear size={15} color="#fff" weight="bold" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.headRow}>
        <View style={[styles.avatar, { backgroundColor: isTasker ? colors.amber : colors.indigo }]}>
          <Text style={[styles.avatarText, { color: isTasker ? '#111' : '#fff' }]}>{initials}</Text>
          {verified && (
            <View style={styles.vbadge}>
              <Check size={11} color="#fff" weight="bold" />
            </View>
          )}
        </View>
        <View style={styles.headInfo}>
          <Text style={[styles.name, { color: colors.ink }]}>{name}</Text>
          {nickname ? (
            <Text style={styles.nickname}>{nickname}</Text>
          ) : null}
          <View style={styles.roleLine}>
            <RoleIcon size={12} color={colors.amber} weight="fill" />
            <Text style={[styles.roleText, { color: colors.muted }]}>
              {roleName}{roleLoc ? ` · ${roleLoc}` : ''}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.white, borderColor: colors.border }]} onPress={onEdit} activeOpacity={0.7}>
        <PencilSimple size={14} color={colors.ink} weight="bold" />
        <Text style={[styles.editBtnText, { color: colors.ink }]}>{t('profile.edit')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const makeStyles = (colors: any) => StyleSheet.create({
  cover: { height: 88, position: 'relative' },
  coverIcons: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', gap: 8 },
  coverIconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, gap: 12, marginTop: -32, marginBottom: 10 },
  avatar: { width: 64, height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFFFFF', position: 'relative', flexShrink: 0 },
  avatarText: { fontSize: 22, fontFamily: fonts.headingBold },
  vbadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: '#FFFFFF' },
  headInfo: { flex: 1, paddingBottom: 4 },
  name: { fontSize: 17, fontFamily: fonts.heading, letterSpacing: -0.3 },
  nickname: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#6B7280', marginTop: 1 },
  roleLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  roleText: { fontSize: 12, fontFamily: fonts.body },
  editBtn: { marginHorizontal: 16, marginBottom: 14, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  editBtnText: { fontSize: 12, fontFamily: fonts.bodyMedium },
})
