import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const AUTH_STORAGE_KEYCHAIN_SERVICE = 'talkpilot.supabase.auth';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: AUTH_STORAGE_KEYCHAIN_SERVICE,
  // Supabase may refresh tokens while the app is backgrounded on iOS.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const secureStoreCache = new Map<string, string>();
const pendingSecureStoreWrites = new Map<string, string | null>();
const INTERACTION_NOT_ALLOWED_PATTERN = /User interaction is not allowed/i;

let secureStoreFlushLifecycleBound = false;

function isInteractionNotAllowedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return INTERACTION_NOT_ALLOWED_PATTERN.test(message);
}

function isIosSecureStoreReadUnsafe() {
  return Platform.OS === 'ios' && AppState.currentState !== 'active';
}

function getPendingValue(key: string): string | null | undefined {
  if (!pendingSecureStoreWrites.has(key)) {
    return undefined;
  }

  return pendingSecureStoreWrites.get(key) ?? null;
}

async function writeSecureStoreValue(
  key: string,
  value: string | null,
): Promise<void> {
  if (value === null) {
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    return;
  }

  await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
}

async function flushPendingSecureStoreWrites(): Promise<void> {
  if (
    Platform.OS === 'web' ||
    pendingSecureStoreWrites.size === 0 ||
    AppState.currentState !== 'active'
  ) {
    return;
  }

  const entries = Array.from(pendingSecureStoreWrites.entries());

  for (const [key, value] of entries) {
    try {
      await writeSecureStoreValue(key, value);
      pendingSecureStoreWrites.delete(key);
    } catch (error) {
      if (isInteractionNotAllowedError(error)) {
        return;
      }
      throw error;
    }
  }
}

function bindSecureStoreFlushLifecycle() {
  if (Platform.OS === 'web' || secureStoreFlushLifecycleBound) {
    return;
  }

  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      void flushPendingSecureStoreWrites();
    }
  });
  secureStoreFlushLifecycleBound = true;
}

export const supabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }

    bindSecureStoreFlushLifecycle();

    const pendingValue = getPendingValue(key);
    if (pendingValue !== undefined) {
      return pendingValue;
    }

    if (isIosSecureStoreReadUnsafe() && secureStoreCache.has(key)) {
      return secureStoreCache.get(key) ?? null;
    }

    try {
      const value = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
      if (value === null) {
        secureStoreCache.delete(key);
      } else {
        secureStoreCache.set(key, value);
      }
      return value;
    } catch (error) {
      if (isInteractionNotAllowedError(error)) {
        return secureStoreCache.get(key) ?? null;
      }
      throw error;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }

    bindSecureStoreFlushLifecycle();
    secureStoreCache.set(key, value);

    try {
      await writeSecureStoreValue(key, value);
      pendingSecureStoreWrites.delete(key);
    } catch (error) {
      if (isInteractionNotAllowedError(error)) {
        pendingSecureStoreWrites.set(key, value);
        return;
      }
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }

    bindSecureStoreFlushLifecycle();
    secureStoreCache.delete(key);

    try {
      await writeSecureStoreValue(key, null);
      pendingSecureStoreWrites.delete(key);
    } catch (error) {
      if (isInteractionNotAllowedError(error)) {
        pendingSecureStoreWrites.set(key, null);
        return;
      }
      throw error;
    }
  },
};
