/**
 * AI Service — Phase 2
 *
 * Whisper: Transcribes voice notes to text via OpenAI API.
 * Claude: Generates professional variation descriptions from transcription + context.
 *
 * Both services degrade gracefully — app works fully without them.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { config } from '../config';
import { updateVoiceTranscription, updateVariation } from '../db/variationRepository';

// ============================================================
// WHISPER TRANSCRIPTION
// ============================================================

/**
 * Transcribe a voice note using OpenAI Whisper API.
 * Updates the voice_notes record directly.
 */
export async function transcribeVoiceNote(
  voiceNoteId: string,
  localUri: string,
): Promise<string | null> {
  if (!config.openai.enabled) {
    console.log('[AI] OpenAI not configured — skipping transcription');
    return null;
  }

  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create form data for Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      body: createFormData(base64, 'audio.m4a'),
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const result = await response.json();
    const transcription = result.text || '';

    // Save to database
    await updateVoiceTranscription(voiceNoteId, transcription, 'complete');

    console.log('[AI] Transcription complete:', transcription.slice(0, 50));
    return transcription;
  } catch (error) {
    console.error('[AI] Transcription failed:', error);
    await updateVoiceTranscription(voiceNoteId, '', 'failed');
    return null;
  }
}

/**
 * Alternative: Local transcription placeholder.
 * In production, could use on-device Whisper via react-native-whisper.
 */
export async function transcribeLocal(localUri: string): Promise<string | null> {
  // Placeholder for on-device transcription
  // Could integrate react-native-whisper for fully offline transcription
  console.log('[AI] Local transcription not yet implemented');
  return null;
}

// ============================================================
// CLAUDE AI DESCRIPTIONS
// ============================================================

/**
 * Generate a professional variation description using Claude.
 * Takes the voice transcription + variation context and produces
 * a formal, contract-ready description.
 */
export async function generateVariationDescription(
  variationId: string,
  context: {
    title: string;
    transcription?: string;
    instructionSource: string;
    instructedBy?: string;
    projectName?: string;
    estimatedValue?: number;
    notes?: string;
  },
): Promise<string | null> {
  if (!config.anthropic.enabled) {
    console.log('[AI] Anthropic not configured — skipping description generation');
    return null;
  }

  try {
    const prompt = buildDescriptionPrompt(context);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const result = await response.json();
    const description = result.content?.[0]?.text || '';

    // Save to database
    await updateVariation(variationId, { aiDescription: description });

    console.log('[AI] Description generated');
    return description;
  } catch (error) {
    console.error('[AI] Description generation failed:', error);
    return null;
  }
}

function buildDescriptionPrompt(context: {
  title: string;
  transcription?: string;
  instructionSource: string;
  instructedBy?: string;
  projectName?: string;
  estimatedValue?: number;
  notes?: string;
}): string {
  const parts = [
    'Generate a professional, contract-ready variation description for a construction project.',
    'Write in formal third person. Be specific and factual. Keep under 200 words.',
    '',
    `Project: ${context.projectName || 'Construction project'}`,
    `Variation: ${context.title}`,
    `Instruction Source: ${context.instructionSource.replace(/_/g, ' ')}`,
  ];

  if (context.instructedBy) parts.push(`Instructed By: ${context.instructedBy}`);
  if (context.estimatedValue) parts.push(`Estimated Value: $${(context.estimatedValue / 100).toLocaleString()}`);
  if (context.transcription) parts.push(`\nSite Voice Memo Transcription:\n"${context.transcription}"`);
  if (context.notes) parts.push(`\nAdditional Notes: ${context.notes}`);

  parts.push('\nWrite the formal variation description:');

  return parts.join('\n');
}

// ============================================================
// BATCH AI PROCESSING
// ============================================================

/**
 * Process all pending transcriptions and descriptions.
 * Called when connectivity is available and AI services are configured.
 */
export async function processAIPending(): Promise<{ transcribed: number; described: number }> {
  // This would query for voice_notes with transcription_status = 'none'
  // and variations without ai_description, then process them.
  // Implementation depends on Supabase being available for queuing.
  return { transcribed: 0, described: 0 };
}

// ============================================================
// HELPERS
// ============================================================

function createFormData(base64Audio: string, filename: string): FormData {
  const formData = new FormData();

  // Convert base64 to blob-like object for React Native
  formData.append('file', {
    uri: `data:audio/m4a;base64,${base64Audio}`,
    type: 'audio/m4a',
    name: filename,
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  return formData;
}
