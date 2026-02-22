import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

let supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (!config.supabase.enabled) {
    return null;
  }

  if (supabase) {
    return supabase;
  }

  try {
    supabase = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    return supabase;
  } catch (error) {
    console.error('[Supabase] Failed to initialize client:', error);
    return null;
  }
};
