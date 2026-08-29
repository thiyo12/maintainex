import { useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../lib/ThemeContext'
import { useTranslation } from 'react-i18next'

type Role = 'tasker' | 'company'

interface Props {
  role: Role
  active: string
  onPress: (tab: string) => void
  unreadMessages?: number
}

const TASKER_TABS = [
  { id: 'home',    label: 'Home',      icon: 'home-outline'          },
  { id: 'explore', label: 'Find Jobs', icon: 'search-outline'        },
  { id: 'fab',     label: '',          icon: 'add'                   },
  { id: 'chat',    label: 'Chat',      icon: 'chatbubble-outline'    },
  { id: 'profile', label: 'Profile',   icon: 'person-circle-outline' },
]

const COMPANY_TABS = [
  { id: 'home',    label: 'Home',     icon: 'home-outline'            },
  { id: 'jobs',    label: 'My Jobs',  icon: 'document-text-outline'   },
  { id: 'fab',     label: '',         icon: 'add'                     },
  { id: 'chat',    label: 'Chat',     icon: 'chatbubble-outline'      },
  { id: 'company', label: 'Company',  icon: 'business-outline'        },
]

export default function BottomNav({ role, active, onPress, unreadMessages = 0 }: Props) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const fabGlow = useRef(new Animated.Value(0.55)).current

  const TASKER_TABS = [
    { id: 'home',    label: t('customer.browse'), icon: 'home-outline'          },
    { id: 'explore', label: t('tasker.findWork'), icon: 'search-outline'        },
    { id: 'fab',     label: '',                   icon: 'add'                    },
    { id: 'chat',    label: t('home.chat'),       icon: 'chatbubble-outline'    },
    { id: 'profile', label: t('profile.title'),   icon: 'person-circle-outline' },
  ]

  const COMPANY_TABS = [
    { id: 'home',    label: t('company.dashboard'),  icon: 'home-outline'            },
    { id: 'jobs',    label: t('company.contracts'),  icon: 'document-text-outline'   },
    { id: 'fab',     label: '',                      icon: 'add'                     },
    { id: 'chat',    label: t('home.chat'),          icon: 'chatbubble-outline'      },
    { id: 'company', label: t('company.profile'),    icon: 'business-outline'        },
  ]

  useEffect(() => {
    // Shadow animation disabled — useNativeDriver: false crashes on Android New Architecture
  }, [])

  const tabs = role === 'tasker' ? TASKER_TABS : COMPANY_TABS

  return (
    <View style={[styles.bar, {
      backgroundColor: colors.white,
      shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
    }]}>
      {tabs.map(tab => {
        if (tab.id === 'fab') {
          return (
            <TouchableOpacity key="fab" onPress={() => onPress('post')} activeOpacity={0.85}>
              <Animated.View style={[styles.fab, {
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: fabGlow,
                shadowRadius: 14,
                elevation: 8,
              }]}>
                <Ionicons name="add" size={26} color="#111827" />
              </Animated.View>
            </TouchableOpacity>
          )
        }
        const isActive = active === tab.id
        const isChat   = tab.id === 'chat'
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && { backgroundColor: colors.amberBg }]}
            onPress={() => onPress(tab.id)}
            activeOpacity={0.7}
          >
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={tab.icon as any}
                size={22}
                color={isActive ? colors.amberDark : colors.muted}
              />
              {isChat && unreadMessages > 0 && (
                <View style={styles.pip} />
              )}
            </View>
            <Text style={[styles.label, { color: isActive ? colors.amberDark : colors.muted }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 20, marginHorizontal: 8,
  },
  tab: {
    flex: 1, alignItems: 'center', gap: 3,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 14,
  },
  fab: {
    width: 48, height: 48, borderRadius: 15,
    backgroundColor: '#F59E0B',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -18,
  },
  pip: {
    position: 'absolute', top: -2, right: -2,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  label: { fontSize: 9, fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
})
