/**
 * Capture Flow — Phase 2
 *
 * 4-step, 60-second capture: Photos → Voice → Details → Confirm
 * Now with direct camera option (Phase 2) and AI transcription trigger.
 */

import { useState, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, Image,
  Alert, Modal, SafeAreaView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { getNextVariationSequence } from '../../src/db/projectRepository';
import { createVariation, addPhotoEvidence, addVoiceNote, updateEvidenceHash } from '../../src/db/variationRepository';
import { InstructionSource } from '../../src/types/domain';
import { generateId, nowISO, formatDuration, parseInputToCents, capitalize } from '../../src/utils/helpers';
import { hashFile, computeCombinedEvidenceHash } from '../../src/services/evidenceChain';
import { getCurrentLocation } from '../../src/services/location';
import { transcribeVoiceNote } from '../../src/services/ai';
import { useAppMode } from '../../src/contexts/AppModeContext';

const STEPS = ['Photos', 'Voice', 'Details', 'Confirm'];

const SOURCES: { value: InstructionSource; label: string; icon: string }[] = [
  { value: InstructionSource.SITE_INSTRUCTION, label: 'Site Instruction', icon: 'document-text-outline' },
  { value: InstructionSource.VERBAL, label: 'Verbal Direction', icon: 'chatbubble-outline' },
  { value: InstructionSource.RFI, label: 'RFI Response', icon: 'mail-outline' },
  { value: InstructionSource.DRAWING, label: 'Drawing Revision', icon: 'map-outline' },
  { value: InstructionSource.LATENT, label: 'Latent Condition', icon: 'alert-circle-outline' },
  { value: InstructionSource.DELAY, label: 'Delay Claim', icon: 'time-outline' },
];

interface CapturedPhoto {
  id: string;
  uri: string;
  hash: string;
}

export default function CaptureScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { isOffice } = useAppMode();
  const [step, setStep] = useState(0);

  // Step 1: Photos
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);

  // Step 2: Voice
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3: Details
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<InstructionSource>(InstructionSource.SITE_INSTRUCTION);
  const [instructedBy, setInstructedBy] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [notes, setNotes] = useState('');

  // Step 4: Saving
  const [saving, setSaving] = useState(false);

  // ============================================================
  // STEP 1: PHOTOS
  // ============================================================

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to capture evidence.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      try {
        const hash = await hashFile(asset.uri);
        setPhotos(prev => [...prev, { id: generateId(), uri: asset.uri, hash }]);
      } catch {
        setPhotos(prev => [...prev, { id: generateId(), uri: asset.uri, hash: 'hash-failed' }]);
      }
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      for (const asset of result.assets) {
        try {
          const hash = await hashFile(asset.uri);
          setPhotos(prev => [...prev, { id: generateId(), uri: asset.uri, hash }]);
        } catch {
          setPhotos(prev => [...prev, { id: generateId(), uri: asset.uri, hash: 'hash-failed' }]);
        }
      }
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  // ============================================================
  // STEP 2: VOICE
  // ============================================================

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone access is required.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(rec);
      setIsRecording(true);
      setVoiceDuration(0);
      setVoiceUri(null);

      durationInterval.current = setInterval(() => {
        setVoiceDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[Capture] Recording failed:', error);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    clearInterval(durationInterval.current!);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setVoiceUri(uri);
      setRecording(null);
      setIsRecording(false);
    } catch (error) {
      console.error('[Capture] Stop recording failed:', error);
      setIsRecording(false);
    }
  };

  // ============================================================
  // STEP 4: SAVE
  // ============================================================

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Variation title is required.');
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const location = await getCurrentLocation();
      const seq = await getNextVariationSequence(projectId!);

      const variation = await createVariation({
        projectId: projectId!,
        sequenceNumber: seq,
        title: title.trim(),
        description: '',
        instructionSource: source,
        instructedBy: instructedBy.trim() || undefined,
        referenceDoc: referenceDoc.trim() || undefined,
        estimatedValue: parseInputToCents(estimatedValue),
        latitude: location?.latitude,
        longitude: location?.longitude,
        locationAccuracy: location?.accuracy,
        notes: notes.trim() || undefined,
      });

      // Save photos
      const photoHashes: string[] = [];
      for (const photo of photos) {
        await addPhotoEvidence({
          id: photo.id,
          variationId: variation.id,
          localUri: photo.uri,
          sha256Hash: photo.hash,
          latitude: location?.latitude,
          longitude: location?.longitude,
          capturedAt: nowISO(),
        });
        photoHashes.push(photo.hash);
      }

      // Save voice note + trigger AI transcription
      let voiceHash: string | undefined;
      if (voiceUri) {
        const vnId = generateId();
        try {
          voiceHash = await hashFile(voiceUri);
        } catch { /* ignore */ }

        await addVoiceNote({
          id: vnId,
          variationId: variation.id,
          localUri: voiceUri,
          durationSeconds: voiceDuration,
          transcriptionStatus: 'none',
          sha256Hash: voiceHash,
          capturedAt: nowISO(),
        });

        // Phase 2: Trigger AI transcription in background
        transcribeVoiceNote(vnId, voiceUri).catch(() => {});
      }

      // Compute combined evidence hash
      const combinedHash = await computeCombinedEvidenceHash(
        photoHashes,
        voiceHash,
        variation.capturedAt,
        location?.latitude,
        location?.longitude,
      );
      await updateEvidenceHash(variation.id, combinedHash);

      router.back();
    } catch (error) {
      console.error('[Capture] Save failed:', error);
      Alert.alert('Error', 'Failed to save variation. Your data is safe — try again.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  const canProceed = () => {
    if (step === 2 && !title.trim()) return false;
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => {
          if (step > 0) setStep(step - 1);
          else {
            Alert.alert('Discard?', 'Unsaved changes will be lost.', [
              { text: 'Keep Editing', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => router.back() },
            ]);
          }
        }}>
          <Ionicons name={step > 0 ? 'arrow-back' : 'close'} size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{STEPS[step]}</Text>
        <Text style={styles.stepIndicator}>{step + 1}/{STEPS.length}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      {/* Content */}
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 0 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepInstruction}>Capture photographic evidence</Text>

            {/* Photo Grid */}
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <Pressable key={photo.id} style={styles.photoThumb} onPress={() => setPhotoViewer(photo.uri)}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <Pressable style={styles.photoRemove} onPress={() => removePhoto(photo.id)}>
                    <Ionicons name="close-circle" size={22} color={colors.danger} />
                  </Pressable>
                </Pressable>
              ))}
            </View>

            <View style={styles.photoActions}>
              <Pressable style={[styles.actionButton, styles.actionButtonPrimary]} onPress={takePhoto}>
                <Ionicons name="camera" size={24} color={colors.textInverse} />
                <Text style={styles.actionButtonTextPrimary}>Take Photo</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={pickFromLibrary}>
                <Ionicons name="images-outline" size={24} color={colors.accent} />
                <Text style={styles.actionButtonText}>Library</Text>
              </Pressable>
            </View>

            <Text style={styles.photoCount}>{photos.length} photo{photos.length !== 1 ? 's' : ''} captured</Text>
          </ScrollView>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepInstruction}>Record a voice memo describing the variation</Text>

            <View style={styles.voiceArea}>
              {isRecording && (
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording</Text>
                  <Text style={styles.recordingTime}>{formatDuration(voiceDuration)}</Text>
                </View>
              )}

              {voiceUri && !isRecording && (
                <View style={styles.voicePreview}>
                  <Ionicons name="mic" size={24} color={colors.success} />
                  <Text style={styles.voicePreviewText}>
                    {formatDuration(voiceDuration)} recorded
                  </Text>
                </View>
              )}

              <Pressable
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={32}
                  color={colors.textInverse}
                />
              </Pressable>

              <Text style={styles.voiceHint}>
                {isRecording ? 'Tap to stop' : voiceUri ? 'Tap to re-record' : 'Tap to start recording'}
              </Text>
            </View>
          </View>
        )}

        {step === 2 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TITLE *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Rock class upgrade — Ch 4200-4350"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>INSTRUCTION SOURCE</Text>
              <View style={styles.sourceGrid}>
                {SOURCES.map((s) => (
                  <Pressable
                    key={s.value}
                    style={[styles.sourceChip, source === s.value && styles.sourceChipActive]}
                    onPress={() => setSource(s.value)}
                  >
                    <Ionicons name={s.icon as any} size={16} color={source === s.value ? colors.accent : colors.textSecondary} />
                    <Text style={[styles.sourceChipText, source === s.value && styles.sourceChipTextActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>INSTRUCTED BY</Text>
              <TextInput
                style={styles.input}
                value={instructedBy}
                onChangeText={setInstructedBy}
                placeholder="e.g. Site Superintendent"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.fieldRow}>
              {isOffice && (
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>ESTIMATED VALUE ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={estimatedValue}
                    onChangeText={setEstimatedValue}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              )}
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>REFERENCE DOC</Text>
                <TextInput
                  style={styles.input}
                  value={referenceDoc}
                  onChangeText={setReferenceDoc}
                  placeholder="SI-042"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional context..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        )}

        {step === 3 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepInstruction}>Review and confirm</Text>

            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{title || 'Untitled'}</Text>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Source</Text>
                <Text style={styles.confirmValue}>{capitalize(source)}</Text>
              </View>
              {instructedBy ? (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Instructed By</Text>
                  <Text style={styles.confirmValue}>{instructedBy}</Text>
                </View>
              ) : null}
              {isOffice && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Value</Text>
                  <Text style={styles.confirmValue}>{estimatedValue ? `$${estimatedValue}` : '$0'}</Text>
                </View>
              )}
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Photos</Text>
                <Text style={styles.confirmValue}>{photos.length}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Voice</Text>
                <Text style={styles.confirmValue}>{voiceUri ? formatDuration(voiceDuration) : 'None'}</Text>
              </View>
            </View>

            {/* Photo thumbnails */}
            {photos.length > 0 && (
              <ScrollView horizontal style={styles.confirmPhotos} showsHorizontalScrollIndicator={false}>
                {photos.map(p => (
                  <Image key={p.id} source={{ uri: p.uri }} style={styles.confirmPhotoThumb} />
                ))}
              </ScrollView>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        {step < 3 ? (
          <Pressable
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>
              {step === 0 && photos.length === 0 ? 'Skip Photos' : 'Next'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle" size={24} color={colors.textInverse} />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Variation'}</Text>
          </Pressable>
        )}
      </View>

      {/* Photo Viewer Modal */}
      <Modal visible={photoViewer !== null} transparent animationType="fade">
        <Pressable style={styles.viewerOverlay} onPress={() => setPhotoViewer(null)}>
          {photoViewer && <Image source={{ uri: photoViewer }} style={styles.viewerImage} resizeMode="contain" />}
          <Pressable style={styles.viewerClose} onPress={() => setPhotoViewer(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  headerTitle: { ...typography.headingSmall, color: colors.text },
  stepIndicator: { ...typography.caption, color: colors.textMuted },
  progressBar: { height: 3, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  progressFill: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
  content: { flex: 1 },
  stepContent: { padding: spacing.lg, paddingBottom: 100 },
  stepInstruction: { ...typography.bodyLarge, color: colors.textSecondary, marginBottom: spacing.lg },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  photoThumb: { width: 100, height: 100, borderRadius: borderRadius.md, overflow: 'hidden' as const },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute' as const, top: 4, right: 4 },
  photoActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.accent },
  actionButtonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionButtonText: { ...typography.labelMedium, color: colors.accent },
  actionButtonTextPrimary: { ...typography.labelMedium, color: colors.textInverse },
  photoCount: { ...typography.caption, color: colors.textMuted, textAlign: 'center' as const },

  // Voice
  voiceArea: { alignItems: 'center' as const, paddingTop: spacing.xxxxl },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  recordingText: { ...typography.labelMedium, color: colors.danger },
  recordingTime: { ...typography.headingMedium, color: colors.text },
  voicePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  voicePreviewText: { ...typography.labelMedium, color: colors.success },
  recordButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  recordButtonActive: { backgroundColor: colors.danger },
  voiceHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.lg },

  // Details
  field: { marginBottom: spacing.lg },
  fieldLabel: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 48 },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' as const },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sourceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sourceChipActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  sourceChipText: { ...typography.caption, color: colors.textSecondary },
  sourceChipTextActive: { color: colors.accent, fontWeight: '700' },

  // Confirm
  confirmCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  confirmTitle: { ...typography.headingSmall, color: colors.text, marginBottom: spacing.md },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  confirmLabel: { ...typography.caption, color: colors.textMuted },
  confirmValue: { ...typography.labelSmall, color: colors.text },
  confirmPhotos: { marginTop: spacing.lg },
  confirmPhotoThumb: { width: 80, height: 80, borderRadius: borderRadius.md, marginRight: spacing.sm },

  // Bottom
  bottomBar: { padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: { ...typography.labelLarge, color: colors.textInverse },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.success, borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.labelLarge, color: colors.textInverse },

  // Viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '90%', height: '80%' },
  viewerClose: { position: 'absolute' as const, top: 50, right: 20 },
});
