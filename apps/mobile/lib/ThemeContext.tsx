import { createContext, useContext, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { lightColors, darkColors } from './colors'

type ColorScheme = 'light' | 'dark'

interface ThemeValue {
  colors: typeof lightColors
  scheme: ColorScheme
  isDark: boolean
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  scheme: 'light',
  isDark: false,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const scheme: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light'

  return (
    <ThemeContext.Provider
      value={{
        colors: scheme === 'dark' ? darkColors : lightColors,
        scheme,
        isDark: scheme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useColors() {
  return useContext(ThemeContext).colors
}

export function useTheme() {
  return useContext(ThemeContext)
}

export { lightColors, darkColors }
