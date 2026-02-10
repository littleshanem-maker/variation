/**
 * Variation Register Screen
 *
 * Shows all variations for a project, filterable by status.
 * Displays total value and at-risk value prominently.
 * The "Capture Variation" button lives in the thumb zone.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProjectById } from '../../src/db/projectRepository';
import { getVariationsForProject } from '../../src/db/variationRepository';
import { Project, Variation, VariationStatus } from '../../src/types';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { formatCurrency, formatDate, formatVariationId } from '../../src/utils/helpers';

const STATUS_CONFIG: Record<VariationStatus, { color: string; bg: string; label: string }> = {
  [VariationStatus.CAPTURED]: { color: colors.status.captured, bg: colors.accentLight, label: 'Captured' },
  [VariationStatus.SUBMITTED]: { color: colors.status.submitted, bg: colors.infoLight, label: 'Submitted' },
  [VariationStatus.APPROVED]: { color: colors.status.approved, bg: colors.successLight, label: 'Approved' },
  [VariationStatus.DISPUTED]: { color: colors.status.disputed, bg: colors.dangerLight, label: 'Disputed' },
  [VariationStatus.PAID]: { color: colors.status.paid, bg: colors.surfaceAlt, label: 'Paid' },
};

export default function VariationRegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [filter, setFilter] = useState<'all' | VariationStatus>('all');

  const loadData = useCallback(async () => {
    if (!id) return;
    const [proj, vars] = await Promise.all([
      getProjectById(id),
      getVariationsForProject(id),
    ]);
    setProject(proj);
    setVariations(vars);
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const filtered = filter === 'all'
    ? variations
    : variations.filter((v) => v.status === filter);

  const totalValue = variations.reduce((sum, v) => sum + v.estimatedValue, 0);
  const atRiskValue = variations
    .filter((v) => [VariationStatus.CAPTURED, VariationStatus.SUBMITTED, VariationStatus.DISPUTED].includes(v.status))
    .reduce((sum, v) => sum + v.estimatedValue, 0);

  const filterOptions: { key: 'all' | VariationStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: variations.length },
    { key: VariationStatus.CAPTURED, label: 'Captured', count: variations.filter((v) => v.status === VariationStatus.CAPTURED).length },
    { key: VariationStatus.SUBMITTED, label: 'Submitted', count: variations.filter((v) => v.status === VariationStatus.SUBMITTED).length },
    { key: VariationStatus.DISPUTED, label: 'Disputed', count: variations.filter((v) => v.status === VariationStatus.DISPUTED).length },
  ];

  const renderVariation = ({ item }: { item: Variation }) => {
    const config = STATUS_CONFIG[item.status];
    return (
      <Pressable
        style={({ pressed }) => [
          styles.variationCard,
          { borderLeftColor: config.color },
          pressed && styles.variationCardPressed,
        ]}
        onPress={() => router.push(`/variation/${item.id}`)}
      >
        <View style={styles.variationHeader}>
          <View style={styles.variationInfo}>
            <View style={styles.variationMeta}>
              <Text style={styles.variationRef}>
                {formatVariationId(item.sequenceNumber)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                <Text style={[styles.statusText, { color: config.color }]}>
                  {config.label}
                </Text>
              </View>
            </View>
            <Text style={styles.variationTitle}>{item.title}</Text>
          </View>
          <Text style={styles.variationValue}>
            {formatCurrency(item.estimatedValue)}
          </Text>
        </View>
        <View style={styles.variationFooter}>
          <Text style={styles.variationDate}>{formatDate(item.capturedAt)}</Text>
        </View>
      </Pressable>
    );
  };

  if (!project) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: project.name,
          headerBackTitle: 'Projects',
        }}
      />

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={[styles.summaryItem, styles.summaryItemBorder]}>
          <Text style={styles.summaryLabel}>TOTAL VALUE</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>AT RISK</Text>
          <Text style={[styles.summaryValue, styles.summaryDanger]}>
            {formatCurrency(atRiskValue)}
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filterOptions.map((f) => (
          <Pressable
            key={f.key}
            style={[
              styles.filterTab,
              filter === f.key && styles.filterTabActive,
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === f.key && styles.filterTabTextActive,
              ]}
            >
              {f.label} ({f.count})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Variation List */}
      <FlatList
        data={filtered}
        renderItem={renderVariation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No variations yet</Text>
          </View>
        }
      />

      {/* Capture Button — thumb zone */}
      <View style={styles.bottomAction}>
        <Pressable
          style={({ pressed }) => [
            styles.captureButton,
            pressed && styles.captureButtonPressed,
          ]}
          onPress={() => router.push(`/capture/${project.id}`)}
        >
          <Ionicons name="camera" size={24} color={colors.textInverse} />
          <Text style={styles.captureButtonText}>Capture Variation</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    padding: spacing.md,
  },
  summaryItemBorder: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  summaryLabel: {
    ...typography.overline,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  summaryDanger: {
    color: colors.danger,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
    maxHeight: 44,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.sm,
  },
  filterTabActive: {
    backgroundColor: colors.text,
  },
  filterTabText: {
    ...typography.labelSmall,
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.textInverse,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  variationCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  variationCardPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  variationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  variationInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  variationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  variationRef: {
    ...typography.overline,
    color: colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  variationTitle: {
    ...typography.labelMedium,
    color: colors.text,
    lineHeight: 19,
  },
  variationValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  variationFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  variationDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    minHeight: touchTargets.buttonLarge,
  },
  captureButtonPressed: {
    backgroundColor: colors.accentHover,
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textInverse,
  },
});
