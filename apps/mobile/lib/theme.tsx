import React, { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lightColors, darkColors, AppColors } from './colors'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeCtx {
  colors: AppColors
  isDark: boolean
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  toggleTheme: () => void
}

const Ctx = createContext<ThemeCtx>({} as ThemeCtx)
const KEY = 'app-theme-mode'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('dark')

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v)
    })
  }, [])

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    AsyncStorage.setItem(KEY, m)
  }

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setMode(next)
  }

  const isDark = mode === 'system' ? sys === 'dark' : mode === 'dark'
  const colors = isDark ? darkColors : lightColors

  return <Ctx.Provider value={{ colors, isDark, mode, setMode, toggleTheme }}>{children}</Ctx.Provider>
}

export const useColors = () => useContext(Ctx).colors
export const useTheme = () => useContext(Ctx)
