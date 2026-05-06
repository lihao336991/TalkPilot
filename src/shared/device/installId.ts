import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const INSTALL_ID_KEY = 'talkpilot.install_id';
const INSTALL_ID_KEYCHAIN_SERVICE = 'talkpilot.installation';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: INSTALL_ID_KEYCHAIN_SERVICE,
  // Keep stable across background/foreground. Also matches the auth storage posture.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

let cachedInstallId: string | null = null;
let inflightPromise: Promise<string> | null = null;

function randomHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeUuidV4(): string {
  const cryptoAny = globalThis.crypto as unknown as {
    randomUUID?: () => string;
    getRandomValues?: (arr: Uint8Array) => Uint8Array;
  } | null;

  if (cryptoAny?.randomUUID) {
    return cryptoAny.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoAny?.getRandomValues) {
    cryptoAny.getRandomValues(bytes);
  } else {
    // Fallback: best-effort entropy. This id is for quota bucketing, not cryptography.
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Per RFC 4122 section 4.4.
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = randomHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

async function readInstallId(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(INSTALL_ID_KEY);
  }
  return SecureStore.getItemAsync(INSTALL_ID_KEY, SECURE_STORE_OPTIONS);
}

async function writeInstallId(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(INSTALL_ID_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(INSTALL_ID_KEY, value, SECURE_STORE_OPTIONS);
}

export async function getOrCreateInstallId(): Promise<string> {
  if (cachedInstallId) {
    return cachedInstallId;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    const existing = await readInstallId();
    if (existing && existing.trim().length > 0) {
      cachedInstallId = existing.trim();
      return cachedInstallId;
    }

    const created = makeUuidV4();
    await writeInstallId(created);
    cachedInstallId = created;
    return created;
  })();

  try {
    return await inflightPromise;
  } finally {
    inflightPromise = null;
  }
}

