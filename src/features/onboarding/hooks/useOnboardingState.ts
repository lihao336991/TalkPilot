import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const ONBOARDING_KEY = "talkpilot.onboarding.completed";
const FORCE_ONBOARDING_KEY = "talkpilot.onboarding.force";

export function useOnboardingState() {
  const [checked, setChecked] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [forceShowOnboarding, setForceShowOnboardingState] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(FORCE_ONBOARDING_KEY),
    ])
      .then(([completedValue, forceValue]) => {
        setHasCompleted(completedValue === "true");
        setForceShowOnboardingState(forceValue === "true");
      })
      .catch(() => {
        setHasCompleted(false);
        setForceShowOnboardingState(false);
      })
      .finally(() => {
        setChecked(true);
      });
  }, []);

  async function markCompleted() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setHasCompleted(true);
  }

  async function setForceShowOnboarding(enabled: boolean) {
    await AsyncStorage.setItem(FORCE_ONBOARDING_KEY, enabled ? "true" : "false");
    setForceShowOnboardingState(enabled);
  }

  return {
    checked,
    hasCompleted,
    forceShowOnboarding,
    markCompleted,
    setForceShowOnboarding,
  };
}
