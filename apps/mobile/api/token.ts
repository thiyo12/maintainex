import * as SecureStore from 'expo-secure-store'

let authToken: string | null = null

export const setAuthToken = async (token: string | null) => {
  authToken = token
  try {
    if (token) {
      await SecureStore.setItemAsync('auth_token', token)
    } else {
      await SecureStore.deleteItemAsync('auth_token')
    }
  } catch (e) {
    console.error('Failed to persist auth token')
  }
}

export const getAuthToken = async (): Promise<string | null> => {
  if (authToken) return authToken
  authToken = await SecureStore.getItemAsync('auth_token')
  return authToken
}
