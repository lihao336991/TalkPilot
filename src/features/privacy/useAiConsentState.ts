import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const AI_CONSENT_STORAGE_KEY = "talkpilot.aiConsent.v1";
const AI_CONSENT_VERSION = "2026-05-11";

type AiConsentRecord = {
  version: string;
  acceptedAt: string;
};

async function readAiConsentRecord() {
  const raw = await AsyncStorage.getItem(AI_CONSENT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AiConsentRecord>;
    if (
      typeof parsed?.version !== "string" ||
      typeof parsed?.acceptedAt !== "string"
    ) {
      return null;
    }

    return parsed as AiConsentRecord;
  } catch {
    return null;
  }
}

export async function hasAcceptedAiConsent() {
  const record = await readAiConsentRecord();
  return record?.version === AI_CONSENT_VERSION;
}

export async function acceptAiConsent() {
  const record: AiConsentRecord = {
    version: AI_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(AI_CONSENT_STORAGE_KEY, JSON.stringify(record));
}

export async function revokeAiConsent() {
  await AsyncStorage.removeItem(AI_CONSENT_STORAGE_KEY);
}

export function useAiConsentState() {
  const [checked, setChecked] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    let mounted = true;

    readAiConsentRecord()
      .then((record) => {
        if (!mounted) {
          return;
        }

        setHasAccepted(record?.version === AI_CONSENT_VERSION);
      })
      .catch(() => {
        if (mounted) {
          setHasAccepted(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setChecked(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const accept = useCallback(async () => {
    await acceptAiConsent();
    setHasAccepted(true);
  }, []);

  const revoke = useCallback(async () => {
    await revokeAiConsent();
    setHasAccepted(false);
  }, []);

  return {
    checked,
    hasAccepted,
    accept,
    revoke,
  };
}
