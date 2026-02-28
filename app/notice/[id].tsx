/**
 * Variation Notice Detail
 *
 * Read-only view with status advance.
 * Status advance: draft → issued; issued (no variation) → creates new variation.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VariationNotice } from '../../src/types/domain';
import { getNoticeById, updateNoticeStatus } from '../../src/db/noticeRepository';
import { getProjectById } from '../../src/db/projectRepository';
import { spacing, borderRadius, typography } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import { formatDate, formatDateTime, nowISO } from '../../src/utils/helpers';

function noticeBadgeColor(status: string, colors: any): string {
  switch (status) {
    case 'issued': return colors.warning ?? '#C8943E';
    case 'acknowledged': return colors.success;
    default: return colors.textMuted;
  }
}

function noticeStatusLabel(status: string): string {
  switch (status) {
    case 'issued': return 'Issued';
    case 'acknowledged': return 'Acknowledged';
    default: return 'Draft';
  }
}

export default function NoticeDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [notice, setNotice] = useState<VariationNotice | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const n = await getNoticeById(id);
      setNotice(n);
      if (n) {
        const p = await getProjectById(n.projectId);
        setProjectName(p?.name ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleIssue = () => {
    Alert.alert(
      'Issue Notice?',
      'Mark this notice as Issued.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue',
          onPress: async () => {
            await updateNoticeStatus(id!, 'issued');
            await load();
          },
        },
      ],
    );
  };

  const handleNewVariation = () => {
    if (!notice) return;
    router.push(`/capture/${notice.projectId}`);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    backBtn: { padding: 4 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { ...typography.headingSmall, color: colors.text },
    headerRight: { minWidth: 40 },
    scroll: { padding: spacing.lg, paddingBottom: 40 },

    // Header section
    noticeMeta: { marginBottom: spacing.lg },
    noticeNumberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    noticeNumber: { ...typography.overline, color: colors.accent, fontSize: 14, letterSpacing: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' as const },
    projectName: { ...typography.caption, color: colors.textMuted },

    // Description
    descriptionCard: {
      backgroundColor: colors.surface, borderRadius: borderRadius.lg,
      padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
      marginBottom: spacing.xl,
    },
    descriptionLabel: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
    descriptionText: { ...typography.bodyMedium, color: colors.text, lineHeight: 22 },

    // Details grid
    section: { marginBottom: spacing.xl },
    sectionTitle: { ...typography.labelLarge, color: colors.text, marginBottom: spacing.md },
    detailGrid: {
      backgroundColor: colors.surface, borderRadius: borderRadius.lg,
      padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    },
    detailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    detailLabel: { ...typography.overline, color: colors.textMuted, flex: 1 },
    detailValue: { ...typography.labelSmall, color: colors.text, flex: 2, textAlign: 'right' as const },

    // Flags
    flagRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    flagChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: spacing.md, paddingVertical: 7,
      borderRadius: borderRadius.full, borderWidth: 1,
    },
    flagChipText: { fontSize: 13, fontWeight: '600' },

    // Linked variation
    linkedRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      backgroundColor: colors.surface, borderRadius: borderRadius.lg,
      padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    },
    linkedText: { flex: 1, ...typography.labelMedium, color: colors.accent },
    linkedArrow: { color: colors.accent },

    // Actions
    actionsSection: {
      backgroundColor: colors.surface, borderRadius: borderRadius.lg,
      overflow: 'hidden' as const, borderWidth: 1, borderColor: colors.border,
      marginTop: spacing.sm,
    },
    actionRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      padding: spacing.lg, minHeight: 52,
    },
    actionRowText: { ...typography.labelMedium, color: colors.accent },
    actionDivider: { height: 1, backgroundColor: colors.border },
  });

  function DetailRow({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  }

  if (loading || !notice) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const badgeColor = noticeBadgeColor(notice.status, colors);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{notice.noticeNumber}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Notice meta: number + project + status badge */}
        <View style={styles.noticeMeta}>
          <View style={styles.noticeNumberRow}>
            <Text style={styles.noticeNumber}>{notice.noticeNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
              <Text style={styles.statusText}>{noticeStatusLabel(notice.status)}</Text>
            </View>
          </View>
          {projectName ? <Text style={styles.projectName}>{projectName}</Text> : null}
        </View>

        {/* Event description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionLabel}>WHAT HAPPENED</Text>
          <Text style={styles.descriptionText}>{notice.eventDescription}</Text>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>

          {/* Flags */}
          <View style={styles.flagRow}>
            <View style={[
              styles.flagChip,
              {
                borderColor: notice.costFlag ? colors.accent : colors.border,
                backgroundColor: notice.costFlag ? colors.accentLight : 'transparent',
              },
            ]}>
              <Ionicons
                name={notice.costFlag ? 'checkmark-circle' : 'close-circle-outline'}
                size={16}
                color={notice.costFlag ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.flagChipText, { color: notice.costFlag ? colors.accent : colors.textMuted }]}>
                Cost Impact
              </Text>
            </View>
            <View style={[
              styles.flagChip,
              {
                borderColor: notice.timeFlag ? colors.warning ?? '#C8943E' : colors.border,
                backgroundColor: notice.timeFlag ? `${colors.warning ?? '#C8943E'}12` : 'transparent',
              },
            ]}>
              <Ionicons
                name={notice.timeFlag ? 'checkmark-circle' : 'close-circle-outline'}
                size={16}
                color={notice.timeFlag ? colors.warning ?? '#C8943E' : colors.textMuted}
              />
              <Text style={[styles.flagChipText, { color: notice.timeFlag ? colors.warning ?? '#C8943E' : colors.textMuted }]}>
                Time Impact
              </Text>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <DetailRow label="Event Date" value={formatDate(notice.eventDate)} />
            {notice.estimatedDays !== undefined && (
              <DetailRow label="Estimated Days" value={`${notice.estimatedDays} day${notice.estimatedDays !== 1 ? 's' : ''}`} />
            )}
            {notice.contractClause && (
              <DetailRow label="Contract Clause" value={notice.contractClause} />
            )}
            <DetailRow label="Captured" value={formatDateTime(notice.createdAt)} />
            {notice.issuedAt && (
              <DetailRow label="Issued At" value={formatDateTime(notice.issuedAt)} />
            )}
            {notice.acknowledgedAt && (
              <DetailRow label="Acknowledged At" value={formatDateTime(notice.acknowledgedAt)} />
            )}
          </View>
        </View>

        {/* Issued by */}
        {(notice.issuedByName || notice.issuedByEmail) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issued By</Text>
            <View style={styles.detailGrid}>
              {notice.issuedByName && <DetailRow label="Name" value={notice.issuedByName} />}
              {notice.issuedByEmail && <DetailRow label="Email" value={notice.issuedByEmail} />}
            </View>
          </View>
        )}

        {/* Linked variation */}
        {notice.variationId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Variation Request</Text>
            <Pressable
              style={({ pressed }) => [styles.linkedRow, { opacity: pressed ? 0.75 : 1 }]}
              onPress={() => router.push(`/variation/${notice.variationId}`)}
            >
              <Ionicons name="link-outline" size={20} color={colors.accent} />
              <Text style={styles.linkedText}>Open Variation Request →</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </Pressable>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          {notice.status === 'draft' && (
            <>
              <Pressable style={styles.actionRow} onPress={handleIssue}>
                <Ionicons name="send" size={22} color={colors.accent} />
                <Text style={styles.actionRowText}>Issue Notice</Text>
              </Pressable>
              <View style={styles.actionDivider} />
            </>
          )}
          {notice.status === 'issued' && !notice.variationId && (
            <>
              <Pressable style={styles.actionRow} onPress={handleNewVariation}>
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                <Text style={styles.actionRowText}>New Variation Request</Text>
              </Pressable>
              <View style={styles.actionDivider} />
            </>
          )}
          <Pressable style={styles.actionRow} onPress={() => router.back()}>
            <Ionicons name="arrow-back-outline" size={22} color={colors.textMuted} />
            <Text style={[styles.actionRowText, { color: colors.textMuted }]}>Back to Project</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}
