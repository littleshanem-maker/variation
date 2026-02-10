/**
 * Capture Flow Screen
 *
 * The heart of Variation Capture — the 60-second workflow.
 * Full-screen modal with 4 steps:
 *   1. Photos — snap evidence of the scope change
 *   2. Voice — record a description (30-90 seconds)
 *   3. Details — reference number, estimated value
 *   4. Confirm — AI description, evidence summary, save
 *
 * Design constraints (from field operations reality):
 * - User wearing gloves, hands dirty
 * - Standing in direct sunlight
 * - Between tasks, not at a desk
 * - 30 seconds of attention, not 5 minutes
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { getCurrentLocation, formatCoordinates } from '../../src/services/location';
import {
  CaptureInProgress,
  InstructionSource,
} from '../../src/types';
import { nowISO, formatDuration, formatDateTime } from '../../src/utils/helpers';
import { saveVariation } from '../../src/db/variationRepository';

const STEPS = ['Photos', 'Voice', 'Details', 'Confirm'];

const INSTRUCTION_SOURCES: { value: InstructionSource; label: string }[] = [
  { value: InstructionSource.SITE_INSTRUCTION, label: 'Site Instruction (SI)' },
  { value: InstructionSource.RFI_RESPONSE, label: 'RFI Response' },
  { value: InstructionSource.VERBAL_DIRECTION, label: 'Verbal Direction' },
  { value: InstructionSource.DRAWING_REVISION, label: 'Drawing Revision' },
  { value: InstructionSource.LATENT_CONDITION, label: 'Latent Condition' },
  { value: InstructionSource.EMAIL, label: 'Email Instruction' },
];

export default function CaptureScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  // Flow state
  const [step, setStep] = useState(1);
  const [startTime] = useState(Date.now());

  // Capture data
  const [photos, setPhotos] = useState<CaptureInProgress['photos']>([]);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [instructionSource, setInstructionSource] = useState<InstructionSource>(
    InstructionSource.SITE_INSTRUCTION,
  );
  const [reference, setReference] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get location on mount
  useEffect(() => {
    getCurrentLocation().then((loc) => {
      if (loc) setLocation({ lat: loc.latitude, lng: loc.longitude });
    });
  }, []);

  // ============================================================
  // PHOTO CAPTURE
  // ============================================================

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is required to capture evidence photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const loc = await getCurrentLocation(2000);
      setPhotos((prev) => [
        ...prev,
        {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
          capturedAt: nowISO(),
        },
      ]);
      if (loc && !location) {
        setLocation({ lat: loc.latitude, lng: loc.longitude });
      }
    }
  };

  // ============================================================
  // VOICE RECORDING
  // ============================================================

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone Permission', 'Microphone access is required for voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      console.error('[Capture] Recording failed:', error);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    clearInterval(timerRef.current!);
    setIsRecording(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (uri) {
        setVoiceUri(uri);
        setVoiceDuration(recordingTime);
      }
    } catch (error) {
      console.error('[Capture] Stop recording failed:', error);
    }
    recordingRef.current = null;
  };

  // ============================================================
  // SAVE
  // ============================================================

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);

    try {
      const capture: CaptureInProgress = {
        projectId,
        photos,
        voiceNote: voiceUri
          ? { uri: voiceUri, durationSeconds: voiceDuration, capturedAt: nowISO() }
          : undefined,
        instructionSource,
        instructionReference: reference || undefined,
        estimatedValue: estimatedValue
          ? Math.round(parseFloat(estimatedValue.replace(/[^0-9.]/g, '')) * 100)
          : undefined,
        notes: notes || undefined,
        startedAt: new Date(startTime).toISOString(),
        latitude: location?.lat,
        longitude: location?.lng,
      };

      await saveVariation(capture, 'current-user'); // TODO: real user ID

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      Alert.alert(
        'Variation Captured ✓',
        `Evidence locked in ${elapsed} seconds.\nGPS, timestamp, and integrity hash recorded.`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (error) {
      console.error('[Capture] Save failed:', error);
      Alert.alert('Save Failed', 'Your data has been preserved locally. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>New Variation</Text>
          <Text style={styles.headerSubtitle}>Step {step}/4 · {STEPS[step - 1]}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={[
              styles.progressSegment,
              { backgroundColor: s <= step ? colors.accent : colors.border },
            ]}
          />
        ))}
      </View>

      {/* Step Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {step === 1 && (
          <View>
            <Text style={styles.stepInstruction}>
              Photograph the scope change. Capture the affected area, any reference
              points, and the instruction source if written.
            </Text>

            {/* Photo Grid */}
            <View style={styles.photoGrid}>
              {photos.map((photo, i) => (
                <View key={i} style={styles.photoThumb}>
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoNumber}>{i + 1}</Text>
                    <Ionicons name="image" size={24} color="rgba(255,255,255,0.7)" />
                  </View>
                </View>
              ))}
            </View>

            {/* Auto-metadata badge */}
            {photos.length > 0 && (
              <View style={styles.metadataBadge}>
                <View style={styles.metadataItem}>
                  <Ionicons name="location" size={14} color={colors.success} />
                  <Text style={styles.metadataText}>
                    {location ? formatCoordinates(location.lat, location.lng) : 'Getting GPS...'}
                  </Text>
                </View>
                <View style={styles.metadataItem}>
                  <Ionicons name="time" size={14} color={colors.success} />
                  <Text style={styles.metadataText}>{formatDateTime(nowISO())}</Text>
                </View>
                <View style={styles.metadataItem}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                  <Text style={styles.metadataText}>Locked</Text>
                </View>
              </View>
            )}

            {/* Take Photo Button */}
            <Pressable
              style={({ pressed }) => [
                styles.photoButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={28} color={colors.textInverse} />
              <Text style={styles.photoButtonText}>
                {photos.length === 0 ? 'Take Photo' : 'Add Another Photo'}
              </Text>
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={styles.voiceStep}>
            <Text style={styles.stepInstruction}>
              Describe what changed and why. Mention who instructed it, the
              affected area, and any contract references.
            </Text>

            <View style={styles.recordingArea}>
              <Pressable
                style={[
                  styles.recordButton,
                  isRecording && styles.recordButtonActive,
                ]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <View style={styles.stopIcon} />
                ) : (
                  <Ionicons name="mic" size={32} color={colors.textInverse} />
                )}
              </Pressable>

              <Text style={styles.recordingStatus}>
                {isRecording
                  ? formatDuration(recordingTime)
                  : voiceUri
                  ? 'Recording saved ✓'
                  : 'Tap to record'}
              </Text>

              {isRecording && (
                <Text style={styles.recordingIndicator}>Recording...</Text>
              )}

              {voiceUri && !isRecording && (
                <View style={styles.voiceSavedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.voiceSavedText}>
                    Voice note captured — AI will transcribe on save
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.stepInstruction}>
              Add reference numbers and estimated value. AI will generate the
              formal description from your photos and voice note.
            </Text>

            <Text style={styles.fieldLabel}>INSTRUCTION TYPE</Text>
            <View style={styles.sourceGrid}>
              {INSTRUCTION_SOURCES.map((source) => (
                <Pressable
                  key={source.value}
                  style={[
                    styles.sourceOption,
                    instructionSource === source.value && styles.sourceOptionActive,
                  ]}
                  onPress={() => setInstructionSource(source.value)}
                >
                  <Text
                    style={[
                      styles.sourceOptionText,
                      instructionSource === source.value && styles.sourceOptionTextActive,
                    ]}
                  >
                    {source.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>REFERENCE NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. SI-2026-052"
              placeholderTextColor={colors.textMuted}
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>ESTIMATED VALUE</Text>
            <View style={styles.currencyInput}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={[styles.input, styles.currencyField]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={estimatedValue}
                onChangeText={setEstimatedValue}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.fieldLabel}>ADDITIONAL NOTES (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any extra details..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.stepInstruction}>
              Review your capture and save. The evidence chain locks on save —
              no retroactive changes.
            </Text>

            {/* Capture Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>CAPTURE SUMMARY</Text>
              {[
                { label: 'Photos', value: `${photos.length} captured` },
                { label: 'Voice Note', value: voiceUri ? `${formatDuration(voiceDuration)} recorded` : 'None' },
                { label: 'Type', value: INSTRUCTION_SOURCES.find(s => s.value === instructionSource)?.label },
                { label: 'Reference', value: reference || '—' },
                { label: 'Est. Value', value: estimatedValue ? `$${estimatedValue}` : '—' },
                { label: 'Location', value: location ? formatCoordinates(location.lat, location.lng) : 'Unavailable' },
                { label: 'Timestamp', value: formatDateTime(nowISO()) },
              ].map((item, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <Text style={styles.summaryValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Evidence Chain Badge */}
            <View style={styles.evidenceBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
              <Text style={styles.evidenceBadgeText}>
                Evidence chain locks on save — immutable record created
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions — thumb zone */}
      <View style={styles.bottomActions}>
        {step > 1 && (
          <Pressable
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        )}
        {step < 4 ? (
          <Pressable
            style={[styles.nextButton, step === 1 && { flex: 1 }]}
            onPress={() => setStep(step + 1)}
          >
            <Text style={styles.nextButtonText}>Next →</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.saveButton, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark" size={22} color={colors.textInverse} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Variation'}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headingLarge,
    color: colors.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.lg,
  },
  stepInstruction: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  photoThumb: {
    width: '48%',
    aspectRatio: 4 / 3,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#8B7355',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNumber: {
    position: 'absolute',
    top: 6,
    left: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  metadataBadge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginBottom: spacing.lg,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    ...typography.caption,
    color: colors.success,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    minHeight: touchTargets.buttonLarge,
  },
  photoButtonText: {
    ...typography.labelLarge,
    color: colors.textInverse,
  },

  // Voice
  voiceStep: {
    alignItems: 'center',
  },
  recordingArea: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  recordButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: {
    backgroundColor: colors.danger,
  },
  stopIcon: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.textInverse,
  },
  recordingStatus: {
    ...typography.labelMedium,
    color: colors.text,
    marginTop: spacing.md,
  },
  recordingIndicator: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  voiceSavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  voiceSavedText: {
    ...typography.bodySmall,
    color: colors.success,
    fontWeight: '600',
  },

  // Details
  fieldLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sourceOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sourceOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  sourceOptionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  sourceOptionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    minHeight: touchTargets.minimum,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  currencyField: {
    flex: 1,
    paddingLeft: 28,
    fontWeight: '700',
  },

  // Confirm
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}40`,
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
  },
  evidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  evidenceBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
    flex: 1,
  },

  // Bottom Actions
  bottomActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: touchTargets.button,
  },
  backButtonText: {
    ...typography.labelLarge,
    color: colors.text,
  },
  nextButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent,
    minHeight: touchTargets.button,
  },
  nextButtonText: {
    ...typography.labelLarge,
    color: colors.textInverse,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.success,
    minHeight: touchTargets.button,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textInverse,
  },
});
