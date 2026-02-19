/**
 * Variation Detail — Phase 2
 *
 * Full evidence record with:
 * - Status lifecycle (Captured → Submitted → Approved → Paid, Disputed at any stage)
 * - Voice playback
 * - Full-screen photo viewer
 * - Edit mode
 * - AI description generation (Phase 2)
 * - PDF export with embedded photos (Phase 2)
 * - Delete
 */

import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, TextInput,
  Image, Modal, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { VariationDetail, VariationStatus } from '../../src/types/domain';
import {
  getVariationDetail, updateVariation, updateVariationStatus, deleteVariation,
} from '../../src/db/variationRepository';
import { spacing, borderRadius, typography, touchTargets, getStatusColor, getStatusLabel } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import {
  formatCurrency, formatDateTime, formatVariationId, formatDuration,
  capitalize, centsToInputString, parseInputToCents,
} from '../../src/utils/helpers';
import { formatCoordinates } from '../../src/services/location';
import { exportVariationPDF } from '../../src/services/pdfExport';
import { generateVariationDescription } from '../../src/services/ai';
import { config } from '../../src/config';
import { useAppMode } from '../../src/contexts/AppModeContext';
import { getAttachmentsForVariation, addAttachment, Attachment } from '../../src/db/attachmentRepository';
import { openAttachment, getFileIcon, formatFileSize, pickAttachment } from '../../src/services/attachments';

// Status transition rules
const NEXT_STATUS: Record<string, VariationStatus[]> = {
  captured: [VariationStatus.SUBMITTED, VariationStatus.DISPUTED],
  submitted: [VariationStatus.APPROVED, VariationStatus.DISPUTED],
  approved: [VariationStatus.PAID, VariationStatus.DISPUTED],
  disputed: [VariationStatus.SUBMITTED, VariationStatus.APPROVED],
  paid: [],
};

export default function VariationDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOffice, isField } = useAppMode();
  const [variation, setVariation] = useState<VariationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editInstructedBy, setEditInstructedBy] = useState('');

  // Voice playback
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  // Photo viewer
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getVariationDetail(id);
      setVariation(data);
      if (data) {
        setEditValue(centsToInputString(data.estimatedValue));
        setEditDescription(data.description);
        setEditNotes(data.notes || '');
        setEditReference(data.referenceDoc || '');
        setEditInstructedBy(data.instructedBy || '');
      }
      const atts = await getAttachmentsForVariation(id);
      setAttachments(atts);
    } catch (error) {
      console.error('[Detail] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ============================================================
  // ACTIONS
  // ============================================================

  const handleStatusChange = (newStatus: VariationStatus) => {
    const label = getStatusLabel(newStatus);
    Alert.alert(
      `Mark as ${label}?`,
      `Change status from ${getStatusLabel(variation!.status)} to ${label}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          onPress: async () => {
            await updateVariationStatus(id!, newStatus);
            await load();
          },
        },
      ],
    );
  };

  const handleExportPDF = async () => {
    if (!variation) return;
    setExporting(true);
    try {
      await exportVariationPDF(variation);
    } catch (error) {
      Alert.alert('Error', 'PDF export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!variation) return;
    setGeneratingAI(true);
    try {
      const transcription = variation.voiceNotes.find(v => v.transcription)?.transcription;
      const desc = await generateVariationDescription(variation.id, {
        title: variation.title,
        transcription,
        instructionSource: variation.instructionSource,
        instructedBy: variation.instructedBy,
        projectName: variation.projectName,
        estimatedValue: variation.estimatedValue,
        notes: variation.notes,
      });
      if (desc) {
        await load();
        Alert.alert('Done', 'AI description generated.');
      } else {
        Alert.alert('AI Not Available', 'Configure your Anthropic API key in app.json to enable AI descriptions.');
      }
    } catch (error) {
      Alert.alert('Error', 'AI generation failed.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await updateVariation(id!, {
        estimatedValue: parseInputToCents(editValue),
        description: editDescription,
        notes: editNotes,
        referenceDoc: editReference,
        instructedBy: editInstructedBy,
      });
      setEditing(false);
      await load();
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Variation',
      `Delete ${formatVariationId(variation!.sequenceNumber)}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteVariation(id!);
            router.back();
          },
        },
      ],
    );
  };

  // Voice playback
  const togglePlayback = async (uri: string) => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlaying(false);
        return;
      }

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      setPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('[Detail] Playback failed:', error);
      setPlaying(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },

  // Header
  header: { marginBottom: spacing.lg },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  varId: { ...typography.overline, color: colors.accent },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.textInverse, textTransform: 'uppercase' as const },
  title: { ...typography.headingMedium, color: colors.text, marginBottom: 4 },
  projectName: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  value: { fontSize: 28, fontWeight: '900', color: colors.text },

  // Status Actions
  statusActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statusButton: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.lg, borderWidth: 2, alignItems: 'center' as const },
  statusButtonText: { ...typography.labelMedium, fontWeight: '700' },

  // Sections
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { ...typography.labelLarge, color: colors.text },

  // Details grid
  detailGrid: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { ...typography.overline, color: colors.textMuted, flex: 1 },
  detailValue: { ...typography.labelSmall, color: colors.text, flex: 2, textAlign: 'right' as const },
  fullWidth: { paddingVertical: spacing.sm },
  descriptionText: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: 4, lineHeight: 22 },

  // Edit form
  editForm: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accent },
  editField: { marginBottom: spacing.md },
  editLabel: { ...typography.overline, color: colors.textMuted, marginBottom: 4 },
  editInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: 15, color: colors.text },
  editInputMulti: { minHeight: 80, textAlignVertical: 'top' as const },
  editSaveButton: { backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 12, alignItems: 'center' as const, marginTop: spacing.sm },
  editSaveText: { ...typography.labelMedium, color: colors.textInverse },

  // AI
  aiButton: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.accentLight, borderWidth: 1, borderColor: colors.accent },
  aiButtonText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  aiCard: { backgroundColor: '#FFF8F0', borderRadius: borderRadius.lg, padding: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.accent },
  aiText: { ...typography.bodyMedium, color: colors.textSecondary, lineHeight: 22 },
  aiRegenerate: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: `${colors.accent}30` },
  aiRegenerateText: { ...typography.caption, color: colors.accent },
  aiPlaceholder: { ...typography.bodyMedium, color: colors.textMuted, fontStyle: 'italic' },

  // Photos
  photoScroll: { marginTop: spacing.sm },
  photoCard: { width: 160, marginRight: spacing.md, borderRadius: borderRadius.lg, overflow: 'hidden' as const, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  photoImage: { width: 160, height: 120 },
  photoMeta: { padding: spacing.sm },
  photoHash: { fontSize: 9, fontFamily: 'monospace', color: colors.textMuted },
  photoGps: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  // Voice
  voiceCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: spacing.md },
  voiceInfo: { flex: 1 },
  voiceDuration: { ...typography.labelMedium, color: colors.text },
  voiceTranscription: { ...typography.bodyMedium, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4, lineHeight: 20 },
  voiceTranscriptionPending: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 },
  voiceHash: { fontSize: 9, fontFamily: 'monospace', color: colors.textMuted, marginTop: 6 },

  // History
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, paddingLeft: 4 },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, marginRight: spacing.md },
  historyContent: { flex: 1 },
  historyStatus: { ...typography.labelSmall, color: colors.text },
  historyDate: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  historyNotes: { ...typography.caption, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  historyLine: { position: 'absolute' as const, left: 8, top: 16, bottom: -4, width: 1, backgroundColor: colors.border },

  // Evidence
  evidenceSection: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.successLight, borderRadius: borderRadius.lg, marginBottom: spacing.xl },
  evidenceLabel: { ...typography.labelSmall, color: colors.success },
  evidenceHash: { fontSize: 9, fontFamily: 'monospace', color: colors.textMuted, marginTop: 2 },

  // Actions
  actionsSection: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, overflow: 'hidden' as const, borderWidth: 1, borderColor: colors.border },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: touchTargets.button },
  actionRowDisabled: { opacity: 0.5 },
  actionRowText: { ...typography.labelMedium, color: colors.accent },
  actionDivider: { height: 1, backgroundColor: colors.border },

  // Viewer
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '90%', height: '80%' },
  viewerClose: { position: 'absolute' as const, top: 50, right: 20 },

  // Attachments
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  attachInfo: { flex: 1 },
  attachName: { ...typography.labelSmall, color: colors.text },
  attachSize: { fontSize: 10, fontFamily: 'monospace', color: colors.textMuted, marginTop: 2 },
  });

  function DetailRow({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  }

  if (loading || !variation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const nextStatuses = NEXT_STATUS[variation.status] || [];
  const availableStatuses = isField
    ? nextStatuses.filter(s => s === VariationStatus.SUBMITTED)
    : nextStatuses;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.varId}>{formatVariationId(variation.sequenceNumber)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(variation.status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(variation.status)}</Text>
            </View>
          </View>
          <Text style={styles.title}>{variation.title}</Text>
          {variation.projectName && (
            <Text style={styles.projectName}>{variation.projectName}</Text>
          )}
          {isOffice && <Text style={styles.value}>{formatCurrency(variation.estimatedValue)}</Text>}
        </View>

        {/* Status Actions */}
        {availableStatuses.length > 0 && (
          <View style={styles.statusActions}>
            {availableStatuses.map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.statusButton,
                  { borderColor: getStatusColor(s) },
                ]}
                onPress={() => handleStatusChange(s)}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    { color: getStatusColor(s) },
                  ]}
                >
                  {s === VariationStatus.DISPUTED ? 'Dispute'
                    : (isField && s === VariationStatus.SUBMITTED) ? 'Submit'
                    : `Mark ${getStatusLabel(s)}`}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Details</Text>
            {isOffice && (
              <Pressable onPress={() => setEditing(!editing)}>
                <Ionicons name={editing ? 'close' : 'create-outline'} size={20} color={colors.accent} />
              </Pressable>
            )}
          </View>

          {editing ? (
            <View style={styles.editForm}>
              {isOffice && (
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>ESTIMATED VALUE ($)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    keyboardType="numeric"
                  />
                </View>
              )}
              <View style={styles.editField}>
                <Text style={styles.editLabel}>INSTRUCTED BY</Text>
                <TextInput
                  style={styles.editInput}
                  value={editInstructedBy}
                  onChangeText={setEditInstructedBy}
                />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>REFERENCE</Text>
                <TextInput
                  style={styles.editInput}
                  value={editReference}
                  onChangeText={setEditReference}
                />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.editInput, styles.editInputMulti]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>NOTES</Text>
                <TextInput
                  style={[styles.editInput, styles.editInputMulti]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <Pressable style={styles.editSaveButton} onPress={handleSaveEdit}>
                <Text style={styles.editSaveText}>Save Changes</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.detailGrid}>
              <DetailRow label="Captured" value={formatDateTime(variation.capturedAt)} />
              <DetailRow label="Source" value={capitalize(variation.instructionSource)} />
              {variation.instructedBy && <DetailRow label="Instructed By" value={variation.instructedBy} />}
              {variation.referenceDoc && <DetailRow label="Reference" value={variation.referenceDoc} />}
              {variation.latitude && (
                <DetailRow label="GPS" value={formatCoordinates(variation.latitude, variation.longitude!)} />
              )}
              {variation.locationAccuracy && (
                <DetailRow label="Accuracy" value={`\u00B1${Math.round(variation.locationAccuracy)}m`} />
              )}
              {variation.description ? (
                <View style={styles.fullWidth}>
                  <Text style={styles.detailLabel}>DESCRIPTION</Text>
                  <Text style={styles.descriptionText}>{variation.description}</Text>
                </View>
              ) : null}
              {variation.notes ? (
                <View style={styles.fullWidth}>
                  <Text style={styles.detailLabel}>NOTES</Text>
                  <Text style={styles.descriptionText}>{variation.notes}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* AI Description — Phase 2 (hidden for MVP) */}
        {/* Uncomment to re-enable:
        <View style={styles.section}>
          ...AI description section...
        </View>
        */}

        {/* Photos */}
        {variation.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({variation.photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {variation.photos.map((photo) => (
                <Pressable
                  key={photo.id}
                  style={styles.photoCard}
                  onPress={() => setViewerUri(photo.localUri)}
                >
                  <Image source={{ uri: photo.localUri }} style={styles.photoImage} />
                  <View style={styles.photoMeta}>
                    <Text style={styles.photoHash} numberOfLines={1}>
                      SHA-256: {photo.sha256Hash.slice(0, 12)}...
                    </Text>
                    {photo.latitude && (
                      <Text style={styles.photoGps}>
                        {formatCoordinates(photo.latitude, photo.longitude!)}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Voice Notes */}
        {variation.voiceNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voice Notes ({variation.voiceNotes.length})</Text>
            {variation.voiceNotes.map((vn) => (
              <View key={vn.id} style={styles.voiceCard}>
                <Pressable
                  style={styles.playButton}
                  onPress={() => togglePlayback(vn.localUri)}
                >
                  <Ionicons
                    name={playing ? 'stop' : 'play'}
                    size={24}
                    color={colors.textInverse}
                  />
                </Pressable>
                <View style={styles.voiceInfo}>
                  <Text style={styles.voiceDuration}>{formatDuration(vn.durationSeconds)}</Text>
                  {vn.transcription ? (
                    <Text style={styles.voiceTranscription} numberOfLines={3}>
                      "{vn.transcription}"
                    </Text>
                  ) : (
                    <Text style={styles.voiceTranscriptionPending}>
                      {vn.transcriptionStatus === 'pending' ? 'Transcribing...'
                        : vn.transcriptionStatus === 'failed' ? 'Transcription failed'
                        : 'No transcription'}
                    </Text>
                  )}
                  {vn.sha256Hash && (
                    <Text style={styles.voiceHash}>SHA-256: {vn.sha256Hash.slice(0, 12)}...</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Attachments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attachments ({attachments.length})</Text>
            {(variation.status === VariationStatus.CAPTURED || variation.status === VariationStatus.SUBMITTED) && isOffice && (
              <Pressable onPress={async () => {
                const picked = await pickAttachment();
                if (picked) {
                  await addAttachment({
                    id: picked.id,
                    variationId: id!,
                    localUri: picked.uri,
                    fileName: picked.fileName,
                    fileSize: picked.fileSize,
                    mimeType: picked.mimeType,
                    sha256Hash: picked.hash,
                  });
                  await load();
                }
              }}>
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
              </Pressable>
            )}
          </View>

          {attachments.length === 0 ? (
            <Text style={styles.aiPlaceholder}>No attachments. Tap + to add site instructions, RFIs or emails.</Text>
          ) : (
            attachments.map((att) => (
              <Pressable key={att.id} style={styles.attachRow} onPress={() => openAttachment(att.localUri)}>
                <Ionicons name={getFileIcon(att.mimeType) as any} size={22} color={colors.accent} />
                <View style={styles.attachInfo}>
                  <Text style={styles.attachName} numberOfLines={1}>{att.fileName}</Text>
                  <Text style={styles.attachSize}>{formatFileSize(att.fileSize)} · SHA: {att.sha256Hash.slice(0, 8)}...</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
        </View>

        {/* Status History */}
        {variation.statusHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status History</Text>
            {variation.statusHistory.map((sc, i) => (
              <View key={sc.id} style={styles.historyItem}>
                <View style={[styles.historyDot, { backgroundColor: getStatusColor(sc.toStatus) }]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyStatus}>
                    {sc.fromStatus ? `${getStatusLabel(sc.fromStatus)} \u2192 ` : ''}
                    {getStatusLabel(sc.toStatus)}
                  </Text>
                  <Text style={styles.historyDate}>{formatDateTime(sc.changedAt)}</Text>
                  {sc.notes && <Text style={styles.historyNotes}>{sc.notes}</Text>}
                </View>
                {i < variation.statusHistory.length - 1 && <View style={styles.historyLine} />}
              </View>
            ))}
          </View>
        )}

        {/* Evidence Hash */}
        {variation.evidenceHash && (
          <View style={styles.evidenceSection}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
            <View>
              <Text style={styles.evidenceLabel}>Evidence Chain Verified</Text>
              <Text style={styles.evidenceHash}>{variation.evidenceHash}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        {(isOffice || variation.status === VariationStatus.CAPTURED) && (
          <View style={styles.actionsSection}>
            {/* Modify — Field can modify Draft; Office can modify Draft + Submitted */}
            {((isField && variation.status === VariationStatus.CAPTURED) ||
              (isOffice && (variation.status === VariationStatus.CAPTURED || variation.status === VariationStatus.SUBMITTED))) && (
              <>
                <Pressable
                  style={styles.actionRow}
                  onPress={() => setEditing(!editing)}
                >
                  <Ionicons name="create-outline" size={22} color={colors.accent} />
                  <Text style={styles.actionRowText}>{editing ? 'Cancel Modify' : 'Modify Variation'}</Text>
                </Pressable>
                <View style={styles.actionDivider} />
              </>
            )}

            {isOffice && (
              <>
                <Pressable
                  style={[styles.actionRow, exporting && styles.actionRowDisabled]}
                  onPress={handleExportPDF}
                  disabled={exporting}
                >
                  <Ionicons name="document-text-outline" size={22} color={colors.accent} />
                  <Text style={styles.actionRowText}>
                    {exporting ? 'Generating PDF...' : 'Export as PDF'}
                  </Text>
                </Pressable>
                <View style={styles.actionDivider} />
              </>
            )}

            <Pressable style={styles.actionRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
              <Text style={[styles.actionRowText, { color: colors.danger }]}>Delete Variation</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Photo Viewer Modal */}
      <Modal visible={viewerUri !== null} transparent animationType="fade">
        <Pressable style={styles.viewerOverlay} onPress={() => setViewerUri(null)}>
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
          <Pressable style={styles.viewerClose} onPress={() => setViewerUri(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
