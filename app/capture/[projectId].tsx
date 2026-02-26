/**
 * Capture Flow
 * Desktop: centered card, two-column layout, compact form.
 * Mobile: full-screen step wizard (unchanged).
 */

import { useState, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, Image,
  Alert, Modal, SafeAreaView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { useThemeColors, useAppMode } from '../../src/contexts/AppModeContext';
import { getNextVariationSequence } from '../../src/db/projectRepository';
import { createVariation, addPhotoEvidence, addVoiceNote, updateEvidenceHash } from '../../src/db/variationRepository';
import { getCurrentUser } from '../../src/services/auth';
import { InstructionSource } from '../../src/types/domain';
import { generateId, nowISO, formatDuration, parseInputToCents } from '../../src/utils/helpers';
import { hashFile, computeCombinedEvidenceHash } from '../../src/services/evidenceChain';
import { getCurrentLocation } from '../../src/services/location';
import { transcribeVoiceNote } from '../../src/services/ai';
import { pickAttachment, getFileIcon, formatFileSize, PickedAttachment } from '../../src/services/attachments';
import { addAttachment } from '../../src/db/attachmentRepository';

const STEPS = ['Evidence', 'Details'];

const SOURCES: { value: InstructionSource; label: string; icon: string }[] = [
  { value: InstructionSource.SITE_INSTRUCTION, label: 'Site Instruction', icon: 'document-text-outline' },
  { value: InstructionSource.VERBAL, label: 'Verbal Direction', icon: 'chatbubble-outline' },
  { value: InstructionSource.RFI, label: 'RFI Response', icon: 'mail-outline' },
  { value: InstructionSource.DRAWING, label: 'Drawing Revision', icon: 'map-outline' },
  { value: InstructionSource.LATENT, label: 'Latent Condition', icon: 'alert-circle-outline' },
  { value: InstructionSource.DELAY, label: 'Delay Claim', icon: 'time-outline' },
];

interface CapturedPhoto { id: string; uri: string; hash: string; }

export default function CaptureScreen() {
  const colors = useThemeColors();
  const { isOffice } = useAppMode();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [title, setTitle] = useState('');
  const [source, setSource] = useState<InstructionSource>(InstructionSource.SITE_INSTRUCTION);
  const [instructedBy, setInstructedBy] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  // ── PHOTOS ────────────────────────────────────────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const photoId = generateId();
      // Copy to permanent storage so sync can access it later
      const permanentUri = `${FileSystem.documentDirectory}photos/${photoId}.jpg`;
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}photos/`, { intermediates: true }).catch(() => {});
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });
      const hash = await hashFile(permanentUri).catch(() => 'hash-failed');
      setPhotos(prev => [...prev, { id: photoId, uri: permanentUri, hash }]);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10 });
    if (!result.canceled) {
      for (const asset of result.assets) {
        const photoId = generateId();
        const permanentUri = `${FileSystem.documentDirectory}photos/${photoId}.jpg`;
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}photos/`, { intermediates: true }).catch(() => {});
        await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });
        const hash = await hashFile(permanentUri).catch(() => 'hash-failed');
        setPhotos(prev => [...prev, { id: photoId, uri: permanentUri, hash }]);
      }
    }
  };

  // ── VOICE ─────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Microphone access required.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec); setIsRecording(true); setVoiceDuration(0); setVoiceUri(null);
      durationInterval.current = setInterval(() => setVoiceDuration(p => p + 1), 1000);
    } catch { Alert.alert('Error', 'Could not start recording.'); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    clearInterval(durationInterval.current!);
    await recording.stopAndUnloadAsync();
    setVoiceUri(recording.getURI());
    setRecording(null); setIsRecording(false);
  };

  // ── SAVE ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Variation title is required.'); return; }
    setSaving(true);
    try {
      const location = await getCurrentLocation();
      const seq = await getNextVariationSequence(projectId!);
      // Get requestor info from authenticated user
      const currentUser = await getCurrentUser().catch(() => null);
      const requestorName = currentUser?.fullName || currentUser?.email || undefined;
      const requestorEmail = currentUser?.email || undefined;
      const variation = await createVariation({
        projectId: projectId!, sequenceNumber: seq, title: title.trim(),
        description: description.trim(), instructionSource: source,
        instructedBy: instructedBy.trim() || undefined,
        referenceDoc: referenceDoc.trim() || undefined,
        estimatedValue: parseInputToCents(estimatedValue),
        latitude: location?.latitude, longitude: location?.longitude, locationAccuracy: location?.accuracy,
        notes: notes.trim() || undefined,
        requestorName,
        requestorEmail,
      });
      const photoHashes: string[] = [];
      for (const photo of photos) {
        await addPhotoEvidence({ id: photo.id, variationId: variation.id, localUri: photo.uri, sha256Hash: photo.hash, latitude: location?.latitude, longitude: location?.longitude, capturedAt: nowISO() });
        photoHashes.push(photo.hash);
      }
      let voiceHash: string | undefined;
      if (voiceUri) {
        const vnId = generateId();
        voiceHash = await hashFile(voiceUri).catch(() => undefined);
        await addVoiceNote({ id: vnId, variationId: variation.id, localUri: voiceUri, durationSeconds: voiceDuration, transcriptionStatus: 'none', sha256Hash: voiceHash, capturedAt: nowISO() });
        transcribeVoiceNote(vnId, voiceUri).catch(() => {});
      }
      for (const att of attachments) {
        await addAttachment({ id: att.id, variationId: variation.id, localUri: att.uri, fileName: att.fileName, fileSize: att.fileSize, mimeType: att.mimeType, sha256Hash: att.hash });
      }
      const combinedHash = await computeCombinedEvidenceHash(photoHashes, voiceHash, variation.capturedAt, location?.latitude, location?.longitude);
      await updateEvidenceHash(variation.id, combinedHash);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save. Your data is safe — try again.');
    } finally {
      setSaving(false);
    }
  };

  const isWeb = Platform.OS === 'web';

  // ════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT — single page, no voice
  // ════════════════════════════════════════════════════════════
  if (isWeb) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: 'New Variation' }} />

        {/* Top bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 32, height: 56,
          borderBottomWidth: 1, borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>New Variation</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.border : 'transparent' })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving || !title.trim()}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 7,
                backgroundColor: colors.accent,
                opacity: pressed || saving || !title.trim() ? 0.6 : 1,
              })}
            >
              <Ionicons name="checkmark-circle" size={15} color="#fff" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                {saving ? 'Saving…' : 'Save Variation'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Single-page form — two columns */}
        <ScrollView contentContainerStyle={{ maxWidth: 960, width: '100%', alignSelf: 'center', padding: 32 }}>
          <View style={{ flexDirection: 'row', gap: 32, alignItems: 'flex-start' }}>

            {/* ── LEFT: Photos + Attachments ── */}
            <View style={{ width: 280, flexShrink: 0, gap: 16 }}>

              {/* Photo upload zone */}
              <Pressable
                onPress={pickFromLibrary}
                style={({ pressed }) => ({
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderWidth: 2, borderStyle: 'dashed' as any,
                  borderColor: pressed ? colors.accent : colors.border,
                  borderRadius: 12, paddingVertical: 28,
                  backgroundColor: pressed ? `${colors.accent}08` : colors.surface,
                })}
              >
                <Ionicons name="images-outline" size={28} color={colors.accent} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.accent }}>Upload Photos</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Click to browse</Text>
              </Pressable>

              {/* Photo grid */}
              {photos.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {photos.map((photo) => (
                    <View key={photo.id} style={{ width: 76, height: 76, borderRadius: 8, overflow: 'hidden' }}>
                      <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} />
                      <Pressable
                        onPress={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                        style={{ position: 'absolute', top: 2, right: 2 }}
                      >
                        <Ionicons name="close-circle" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </Text>

              {/* Attachments */}
              <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                <View style={{ padding: 10, borderBottomWidth: attachments.length > 0 ? 1 : 0, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Attachments</Text>
                </View>
                {attachments.map((att, i) => (
                  <View key={att.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: i < attachments.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                    <Ionicons name={getFileIcon(att.mimeType) as any} size={16} color={colors.accent} />
                    <Text style={{ flex: 1, fontSize: 12, color: colors.text }} numberOfLines={1}>{att.fileName}</Text>
                    <Pressable onPress={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}>
                      <Ionicons name="close" size={14} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={async () => { const p = await pickAttachment(); if (p) setAttachments(prev => [...prev, p]); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="attach" size={14} color={colors.accent} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.accent }}>Attach file</Text>
                </Pressable>
              </View>
            </View>

            {/* ── RIGHT: Form fields ── */}
            <View style={{ flex: 1, gap: 16 }}>

              {/* Title */}
              <View>
                <Text style={webLabelStyle}>TITLE *</Text>
                <TextInput
                  style={webInputStyle(colors)}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Rock class upgrade — Ch 4200–4350"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
              </View>

              {/* Source */}
              <View>
                <Text style={webLabelStyle}>INSTRUCTION SOURCE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {SOURCES.map((s) => (
                    <Pressable
                      key={s.value}
                      onPress={() => setSource(s.value)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 11, paddingVertical: 6,
                        borderRadius: borderRadius.full, borderWidth: 1,
                        borderColor: source === s.value ? colors.accent : colors.border,
                        backgroundColor: source === s.value ? colors.accentLight : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: source === s.value ? '700' : '500', color: source === s.value ? colors.accent : colors.textSecondary }}>
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Instructed By + Reference */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={webLabelStyle}>INSTRUCTED BY</Text>
                  <TextInput style={webInputStyle(colors)} value={instructedBy} onChangeText={setInstructedBy} placeholder="e.g. Site Superintendent" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={webLabelStyle}>REFERENCE</Text>
                  <TextInput style={webInputStyle(colors)} value={referenceDoc} onChangeText={setReferenceDoc} placeholder="e.g. SI-042" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              {/* Value */}
              {isOffice && (
                <View style={{ maxWidth: 200 }}>
                  <Text style={webLabelStyle}>ESTIMATED VALUE ($)</Text>
                  <TextInput style={webInputStyle(colors)} value={estimatedValue} onChangeText={setEstimatedValue} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                </View>
              )}

              {/* Description */}
              <View>
                <Text style={webLabelStyle}>DESCRIPTION</Text>
                <TextInput
                  style={[webInputStyle(colors), { minHeight: 90, textAlignVertical: 'top' }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the scope change…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Notes */}
              <View>
                <Text style={webLabelStyle}>NOTES</Text>
                <TextInput
                  style={[webInputStyle(colors), { minHeight: 60, textAlignVertical: 'top' }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Internal notes, follow-up actions…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════
  // MOBILE LAYOUT (unchanged)
  // ════════════════════════════════════════════════════════════
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
    primaryCameraButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 18, marginBottom: spacing.lg },
    primaryCameraText: { ...typography.labelLarge, color: colors.textInverse },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    photoThumb: { width: 100, height: 100, borderRadius: borderRadius.md, overflow: 'hidden' as const },
    photoImage: { width: '100%', height: '100%' },
    photoRemove: { position: 'absolute' as const, top: 4, right: 4 },
    libraryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 12, marginBottom: spacing.sm },
    libraryButtonText: { ...typography.labelMedium, color: colors.accent },
    photoCount: { ...typography.caption, color: colors.textMuted, textAlign: 'center' as const, marginBottom: spacing.xxl },
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
    field: { marginBottom: spacing.lg },
    fieldLabel: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 48 },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' as const },
    sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    sourceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    sourceChipActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
    sourceChipText: { ...typography.caption, color: colors.textSecondary },
    sourceChipTextActive: { color: colors.accent, fontWeight: '700' },
    attachSection: { marginTop: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
    attachSectionTitle: { ...typography.labelMedium, color: colors.text, marginBottom: spacing.md },
    attachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    attachInfo: { flex: 1 },
    attachName: { ...typography.labelSmall, color: colors.text },
    attachSize: { ...typography.caption, color: colors.textMuted },
    attachButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.md, marginTop: spacing.sm },
    attachButtonText: { ...typography.labelMedium, color: colors.accent },
    bottomBar: { padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
    nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button },
    nextButtonText: { ...typography.labelLarge, color: colors.textInverse },
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.success, borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: { ...typography.labelLarge, color: colors.textInverse },
    viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    viewerImage: { width: '90%', height: '80%' },
    viewerClose: { position: 'absolute' as const, top: 50, right: 20 },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => {
          if (step > 0) setStep(step - 1);
          else Alert.alert('Discard?', 'Unsaved changes will be lost.', [{ text: 'Keep Editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => router.back() }]);
        }}>
          <Ionicons name={step > 0 ? 'arrow-back' : 'close'} size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{STEPS[step]}</Text>
        <Text style={styles.stepIndicator}>{step + 1}/{STEPS.length}</Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 0 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepInstruction}>Gather evidence — photos and voice memo</Text>
            <Pressable style={styles.primaryCameraButton} onPress={takePhoto}>
              <Ionicons name="camera" size={32} color={colors.textInverse} />
              <Text style={styles.primaryCameraText}>Take Photo</Text>
            </Pressable>
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <Pressable key={photo.id} style={styles.photoThumb} onPress={() => setPhotoViewer(photo.uri)}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <Pressable style={styles.photoRemove} onPress={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}>
                    <Ionicons name="close-circle" size={22} color={colors.danger} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.libraryButton} onPress={pickFromLibrary}>
              <Ionicons name="images-outline" size={20} color={colors.accent} />
              <Text style={styles.libraryButtonText}>Choose from Library</Text>
            </Pressable>
            <Text style={styles.photoCount}>{photos.length} photo{photos.length !== 1 ? 's' : ''} captured</Text>
            <View style={styles.voiceSection}>
              <Text style={styles.voiceSectionTitle}>Voice Memo</Text>
              {isRecording && <View style={styles.recordingIndicator}><View style={styles.recordingDot} /><Text style={styles.recordingText}>Recording</Text><Text style={styles.recordingTime}>{formatDuration(voiceDuration)}</Text></View>}
              {voiceUri && !isRecording && <View style={styles.voicePreview}><Ionicons name="mic" size={24} color={colors.success} /><Text style={styles.voicePreviewText}>{formatDuration(voiceDuration)} recorded</Text></View>}
              <Pressable style={[styles.recordButton, isRecording && styles.recordButtonActive]} onPress={isRecording ? stopRecording : startRecording}>
                <Ionicons name={isRecording ? 'stop' : 'mic'} size={32} color={colors.textInverse} />
              </Pressable>
              <Text style={styles.voiceHint}>{isRecording ? 'Tap to stop' : voiceUri ? 'Tap to re-record' : 'Tap to start recording'}</Text>
            </View>
            <View style={styles.attachSection}>
              <Text style={styles.attachSectionTitle}>Attachments</Text>
              {attachments.map((att) => (
                <View key={att.id} style={styles.attachRow}>
                  <Ionicons name={getFileIcon(att.mimeType) as any} size={20} color={colors.accent} />
                  <View style={styles.attachInfo}><Text style={styles.attachName} numberOfLines={1}>{att.fileName}</Text><Text style={styles.attachSize}>{formatFileSize(att.fileSize)}</Text></View>
                  <Pressable onPress={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}><Ionicons name="close-circle" size={20} color={colors.danger} /></Pressable>
                </View>
              ))}
              <Pressable style={styles.attachButton} onPress={async () => { const p = await pickAttachment(); if (p) setAttachments(prev => [...prev, p]); }}>
                <Ionicons name="attach" size={20} color={colors.accent} /><Text style={styles.attachButtonText}>Attach Document</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
        {step === 1 && (
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepInstruction}>Add tags and save</Text>
            <View style={styles.field}><Text style={styles.fieldLabel}>TITLE *</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Rock class upgrade — Ch 4200-4350" placeholderTextColor={colors.textMuted} /></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>INSTRUCTION SOURCE</Text><View style={styles.sourceGrid}>{SOURCES.map((s) => (<Pressable key={s.value} style={[styles.sourceChip, source === s.value && styles.sourceChipActive]} onPress={() => setSource(s.value)}><Ionicons name={s.icon as any} size={16} color={source === s.value ? colors.accent : colors.textSecondary} /><Text style={[styles.sourceChipText, source === s.value && styles.sourceChipTextActive]}>{s.label}</Text></Pressable>))}</View></View>
            <View style={styles.field}><Text style={styles.fieldLabel}>INSTRUCTED BY</Text><TextInput style={styles.input} value={instructedBy} onChangeText={setInstructedBy} placeholder="e.g. Site Superintendent" placeholderTextColor={colors.textMuted} /></View>
            {isOffice && <View style={styles.field}><Text style={styles.fieldLabel}>ESTIMATED VALUE ($)</Text><TextInput style={styles.input} value={estimatedValue} onChangeText={setEstimatedValue} placeholder="e.g. 45000" placeholderTextColor={colors.textMuted} keyboardType="numeric" /></View>}
            <View style={styles.field}><Text style={styles.fieldLabel}>DESCRIPTION</Text><TextInput style={[styles.input, styles.inputMultiline]} value={description} onChangeText={setDescription} placeholder="Describe the scope change — rough notes are fine." placeholderTextColor={colors.textMuted} multiline numberOfLines={4} /></View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <View style={styles.bottomBar}>
        {step === 0 ? (
          <Pressable style={styles.nextButton} onPress={() => setStep(1)}><Text style={styles.nextButtonText}>Next: Details</Text><Ionicons name="arrow-forward" size={20} color={colors.textInverse} /></Pressable>
        ) : (
          <Pressable style={[styles.saveButton, (!title.trim() || saving) && styles.saveButtonDisabled]} onPress={handleSave} disabled={!title.trim() || saving}>
            <Ionicons name="checkmark-circle" size={24} color={colors.textInverse} />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Variation'}</Text>
          </Pressable>
        )}
      </View>
      <Modal visible={photoViewer !== null} transparent animationType="fade">
        <Pressable style={styles.viewerOverlay} onPress={() => setPhotoViewer(null)}>
          {photoViewer && <Image source={{ uri: photoViewer }} style={styles.viewerImage} resizeMode="contain" />}
          <Pressable style={styles.viewerClose} onPress={() => setPhotoViewer(null)}><Ionicons name="close" size={28} color="#fff" /></Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── shared web helpers ─────────────────────────────────────
function WebSectionHeader({ title, count, colors }: { title: string; count?: number; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, backgroundColor: colors.accent }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const webLabelStyle: any = {
  fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
  textTransform: 'uppercase', color: '#9a9490', marginBottom: 6,
};

const webInputStyle = (colors: any): any => ({
  backgroundColor: colors.surface,
  borderWidth: 1, borderColor: colors.border,
  borderRadius: 8, padding: 10,
  fontSize: 14, color: colors.text,
  outlineStyle: 'none',
});
