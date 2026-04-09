import { createClient } from '@supabase/supabase-js';
import { useAuthStore } from '../store/authStore';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
);

export const initAuth = async () => {
  const { setUser, setLoading, signOut } = useAuthStore.getState();

  setLoading(true);

  try {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      const { data: anonData } = await supabase.auth.signInAnonymously();
      if (anonData.session) {
        setUser(anonData.session.user.id, anonData.session.access_token);
      }
    } else {
      setUser(data.session.user.id, data.session.access_token);
    }
  } finally {
    setLoading(false);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      setUser(session.user.id, session.access_token);
    } else {
      signOut();
    }
  });
};
