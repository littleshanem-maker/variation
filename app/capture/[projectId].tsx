/**
 * Capture Flow — Simplified
 *
 * 2-step, streamlined capture: Capture (Photos + Voice) → Tag (Title + Source + Instructed By)
 * Optimized for on-site use with direct camera option and AI transcription trigger.
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
import { spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { useThemeColors, useAppMode } from '../../src/contexts/AppModeContext';
import { getNextVariationSequence } from '../../src/db/projectRepository';
import { createVariation, addPhotoEvidence, addVoiceNote, updateEvidenceHash } from '../../src/db/variationRepository';
import { InstructionSource } from '../../src/types/domain';
import { generateId, nowISO, formatDuration, parseInputToCents } from '../../src/utils/helpers';
import { hashFile, computeCombinedEvidenceHash } from '../../src/services/evidenceChain';
import { getCurrentLocation } from '../../src/services/location';
import { transcribeVoiceNote } from '../../src/services/ai';
import { pickAttachment, getFileIcon, formatFileSize, PickedAttachment } from '../../src/services/attachments';
import { addAttachment } from '../../src/db/attachmentRepository';
const STEPS = ['Capture', 'Tag'];

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
  const colors = useThemeColors();
  const { isOffice } = useAppMode();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
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

  // Step 2: Tag details
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<InstructionSource>(InstructionSource.SITE_INSTRUCTION);
  const [instructedBy, setInstructedBy] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [description, setDescription] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);

  // Saving
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
        description: description.trim(),
        instructionSource: source,
        instructedBy: instructedBy.trim() || undefined,
        referenceDoc: undefined,
        estimatedValue: parseInputToCents(estimatedValue),
        latitude: location?.latitude,
        longitude: location?.longitude,
        locationAccuracy: location?.accuracy,
        notes: undefined,
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

      // Save attachments
      for (const att of attachments) {
        await addAttachment({
          id: att.id,
          variationId: variation.id,
          localUri: att.uri,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          sha256Hash: att.hash,
        });
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
    if (step === 1 && !title.trim()) return false;
    return true;
  };

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
  primaryCameraButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 18, marginBottom: spacing.lg },
  primaryCameraText: { ...typography.labelLarge, color: colors.textInverse },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  photoThumb: { width: 100, height: 100, borderRadius: borderRadius.md, overflow: 'hidden' as const },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute' as const, top: 4, right: 4 },
  libraryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 12, marginBottom: spacing.sm },
  libraryButtonText: { ...typography.labelMedium, color: colors.accent },
  photoCount: { ...typography.caption, color: colors.textMuted, textAlign: 'center' as const, marginBottom: spacing.xxl },

  // Voice
  voiceSection: { alignItems: 'center' as const, paddingTop: spacing.lg, paddingBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  voiceSectionTitle: { ...typography.labelMedium, color: colors.text, marginBottom: spacing.lg },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  recordingText: { ...typography.labelMedium, color: colors.danger },
  recordingTime: { ...typography.headingMedium, color: colors.text },
  voicePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  voicePreviewText: { ...typography.labelMedium, color: colors.success },
  recordButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: spacing.md },
  recordButtonActive: { backgroundColor: colors.danger },
  voiceHint: { ...typography.caption, color: colors.textMuted },

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

  // Attachments
  attachSection: { marginTop: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  attachSectionTitle: { ...typography.labelMedium, color: colors.text, marginBottom: spacing.md },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  attachInfo: { flex: 1 },
  attachName: { ...typography.labelSmall, color: colors.text },
  attachSize: { ...typography.caption, color: colors.textMuted },
  attachButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.md, marginTop: spacing.sm },
  attachButtonText: { ...typography.labelMedium, color: colors.accent },

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
            <Text style={styles.stepInstruction}>Gather evidence — photos and voice memo</Text>

            {/* Primary Camera Button */}
            <Pressable style={styles.primaryCameraButton} onPress={takePhoto}>
              <Ionicons name="camera" size={32} color={colors.textInverse} />
              <Text style={styles.primaryCameraText}>Take Photo</Text>
            </Pressable>

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

            {/* Secondary Library Button */}
            <Pressable style={styles.libraryButton} onPress={pickFromLibrary}>
              <Ionicons name="images-outline" size={20} color={colors.accent} />
              <Text style={styles.libraryButtonText}>Choose from Library</Text>
            </Pressable>

            <Text style={styles.photoCount}>{photos.length} photo{photos.length !== 1 ? 's' : ''} captured</Text>

            {/* Voice Recording Section */}
            <View style={styles.voiceSection}>
              <Text style={styles.voiceSectionTitle}>Voice Memo</Text>
              
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

            {/* Attachments */}
            <View style={styles.attachSection}>
              <Text style={styles.attachSectionTitle}>Attachments</Text>

              {attachments.map((att) => (
                <View key={att.id} style={styles.attachRow}>
                  <Ionicons name={getFileIcon(att.mimeType) as any} size={20} color={colors.accent} />
                  <View style={styles.attachInfo}>
                    <Text style={styles.attachName} numberOfLines={1}>{att.fileName}</Text>
                    <Text style={styles.attachSize}>{formatFileSize(att.fileSize)}</Text>
                  </View>
                  <Pressable onPress={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.attachButton} onPress={async () => {
                const picked = await pickAttachment();
                if (picked) setAttachments(prev => [...prev, picked]);
              }}>
                <Ionicons name="attach" size={20} color={colors.accent} />
                <Text style={styles.attachButtonText}>Attach Document</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}

        {step === 1 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepInstruction}>Add tags and save</Text>

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

            {isOffice && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>ESTIMATED VALUE ($)</Text>
                <TextInput
                  style={styles.input}
                  value={estimatedValue}
                  onChangeText={setEstimatedValue}
                  placeholder="e.g. 45000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the scope change — rough notes are fine. AI will formalise it."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
              />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        {step === 0 ? (
          <Pressable
            style={styles.nextButton}
            onPress={() => setStep(1)}
          >
            <Text style={styles.nextButtonText}>Next: Tag</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.saveButton, (!canProceed() || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canProceed() || saving}
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
