/**
 * Variation Detail Screen
 *
 * Shows the full variation record including:
 * - Status and value
 * - Photo evidence
 * - AI-generated description
 * - Capture metadata (GPS, timestamp, user)
 * - Evidence chain hash
 * - Export/submit actions
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getVariationWithEvidence, updateVariationStatus } from '../../src/db/variationRepository';
import { getProjectById } from '../../src/db/projectRepository';
import { VariationWithEvidence, VariationStatus, Project } from '../../src/types';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import {
  formatCurrency,
  formatDateTime,
  formatVariationId,
} from '../../src/utils/helpers';
import { formatCoordinates } from '../../src/services/location';
import { formatHash } from '../../src/services/evidenceChain';
import { exportVariationPdf } from '../../src/services/pdfExport';

const STATUS_CONFIG: Record<VariationStatus, { color: string; bg: string; label: string }> = {
  [VariationStatus.CAPTURED]: { color: colors.status.captured, bg: colors.accentLight, label: 'Captured' },
  [VariationStatus.SUBMITTED]: { color: colors.status.submitted, bg: colors.infoLight, label: 'Submitted' },
  [VariationStatus.APPROVED]: { color: colors.status.approved, bg: colors.successLight, label: 'Approved' },
  [VariationStatus.DISPUTED]: { color: colors.status.disputed, bg: colors.dangerLight, label: 'Disputed' },
  [VariationStatus.PAID]: { color: colors.status.paid, bg: colors.surfaceAlt, label: 'Paid' },
};

export default function VariationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [variation, setVariation] = useState<VariationWithEvidence | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) {
      getVariationWithEvidence(id).then((v) => {
        setVariation(v);
        if (v) {
          getProjectById(v.projectId).then(setProject);
        }
      });
    }
  }, [id]);

  const handleExportPdf = async () => {
    if (!variation || !project) return;
    setExporting(true);
    try {
      await exportVariationPdf(
        variation,
        project.name,
        project.client,
        project.reference,
      );
    } catch (error) {
      console.error('[VariationDetail] PDF export failed:', error);
      Alert.alert('Export Failed', 'Could not generate PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleSubmit = async () => {
    if (!variation) return;
    Alert.alert(
      'Submit to Client',
      `Submit ${formatVariationId(variation.sequenceNumber)} (${formatCurrency(variation.estimatedValue)}) to ${project?.client ?? 'client'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await updateVariationStatus(
                variation.id,
                VariationStatus.SUBMITTED,
                'current-user',
                'Submitted via Variation Capture app',
              );
              const updated = await getVariationWithEvidence(variation.id);
              if (updated) setVariation(updated);
              Alert.alert('Submitted', 'Variation marked as submitted. Export a PDF to send to your client.');
            } catch (error) {
              console.error('[VariationDetail] Submit failed:', error);
              Alert.alert('Error', 'Failed to update status.');
            }
          },
        },
      ],
    );
  };

  if (!variation) return null;

  const config = STATUS_CONFIG[variation.status];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: formatVariationId(variation.sequenceNumber),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status & Value */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: config.color }]} />
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
          <Text style={styles.value}>
            {formatCurrency(variation.estimatedValue)}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{variation.title}</Text>

        {/* Photo Evidence */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            PHOTO EVIDENCE ({variation.photos.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoRow}>
              {variation.photos.map((photo, i) => (
                <View key={photo.id} style={styles.photoThumb}>
                  {photo.localUri ? (
                    <Image
                      source={{ uri: photo.localUri }}
                      style={styles.photoImage}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="image" size={20} color="rgba(255,255,255,0.7)" />
                    </View>
                  )}
                  <Text style={styles.photoLabel}>IMG-{i + 1}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Description */}
        {variation.description && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{variation.description}</Text>
            </View>
          </View>
        )}

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CAPTURE METADATA</Text>
          <View style={styles.metadataCard}>
            {[
              { label: 'Captured', value: formatDateTime(variation.capturedAt) },
              { label: 'Captured By', value: variation.capturedBy },
              {
                label: 'GPS',
                value:
                  variation.latitude && variation.longitude
                    ? formatCoordinates(variation.latitude, variation.longitude)
                    : 'Unavailable',
              },
              {
                label: 'Voice Note',
                value: variation.voiceNote
                  ? `Yes — ${variation.voiceNote.transcription ? 'transcribed' : 'pending transcription'}`
                  : 'None',
              },
              {
                label: 'Evidence Hash',
                value: variation.evidenceHash,
                mono: true,
              },
            ].map((item, i, arr) => (
              <View
                key={i}
                style={[
                  styles.metadataRow,
                  i < arr.length - 1 && styles.metadataRowBorder,
                ]}
              >
                <Text style={styles.metadataLabel}>{item.label}</Text>
                <Text
                  style={[
                    styles.metadataValue,
                    item.mono && styles.metadataMono,
                  ]}
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Evidence Chain Badge */}
        <View style={styles.evidenceBadge}>
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          <Text style={styles.evidenceBadgeText}>
            Immutable evidence chain — no retroactive changes possible
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Pressable
          style={[styles.exportButton, exporting && { opacity: 0.6 }]}
          onPress={handleExportPdf}
          disabled={exporting}
        >
          <Ionicons name="download-outline" size={20} color={colors.text} />
          <Text style={styles.exportButtonText}>{exporting ? 'Generating...' : 'Export PDF'}</Text>
        </Pressable>

        {variation.status === VariationStatus.CAPTURED && (
          <Pressable
            style={styles.submitButton}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>Submit to Client</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  title: {
    ...typography.headingLarge,
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#8B7355',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  descriptionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  descriptionText: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 21,
  },
  metadataCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  metadataRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}40`,
  },
  metadataLabel: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  metadataValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '55%',
    textAlign: 'right',
  },
  metadataMono: {
    fontFamily: 'monospace',
    fontSize: 12,
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
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: touchTargets.button,
  },
  exportButtonText: {
    ...typography.labelMedium,
    color: colors.text,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.status.submitted,
    minHeight: touchTargets.button,
  },
  submitButtonText: {
    ...typography.labelMedium,
    color: colors.textInverse,
  },
});
