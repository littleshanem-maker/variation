/**
 * Configuration
 *
 * Central config for all external services.
 * Set these values to enable cloud features.
 * App works fully offline without them.
 */

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const config = {
  // Supabase — set these to enable cloud sync & auth
  supabase: {
    url: extra.supabaseUrl || '',
    anonKey: extra.supabaseAnonKey || '',
    get enabled() {
      return Boolean(this.url && this.anonKey);
    },
  },

  // OpenAI — set to enable Whisper transcription
  openai: {
    apiKey: extra.openaiApiKey || '',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  // Anthropic — set to enable Claude AI descriptions
  anthropic: {
    apiKey: extra.anthropicApiKey || '',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  // App settings
  app: {
    version: '2.0.0',
    maxPhotoSize: 2048,           // Max photo dimension in pixels
    voiceMaxDuration: 120,         // Max voice recording seconds
    locationTimeoutMs: 5000,       // GPS timeout
    syncIntervalMs: 30000,         // Auto-sync interval when online
    pdfPageWidth: 595,             // A4 width in points
  },
};
