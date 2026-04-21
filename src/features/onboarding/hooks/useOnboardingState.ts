import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const ONBOARDING_KEY = "talkpilot.onboarding.completed";

export function useOnboardingState() {
  const [checked, setChecked] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => {
        setHasCompleted(val === "true");
      })
      .catch(() => {
        setHasCompleted(false);
      })
      .finally(() => {
        setChecked(true);
      });
  }, []);

  async function markCompleted() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setHasCompleted(true);
  }

  return { checked, hasCompleted, markCompleted };
}
