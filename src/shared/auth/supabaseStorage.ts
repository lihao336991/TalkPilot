import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_STORAGE_KEYCHAIN_SERVICE = 'talkpilot.supabase.auth';

export const supabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key, {
      keychainService: AUTH_STORAGE_KEYCHAIN_SERVICE,
    });
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value, {
      keychainService: AUTH_STORAGE_KEYCHAIN_SERVICE,
    });
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key, {
      keychainService: AUTH_STORAGE_KEYCHAIN_SERVICE,
    });
  },
};
