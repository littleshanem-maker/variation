/**
 * Project Detail — Variation Register
 *
 * Shows all variations for a project with filtering, batch export, delete.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProjectById, deleteProject } from '../../src/db/projectRepository';
import { getVariationsForProject, getVariationDetail } from '../../src/db/variationRepository';
import { Project, Variation, VariationStatus, VariationDetail } from '../../src/types/domain';
import { spacing, borderRadius, typography, touchTargets, getStatusColor, getStatusLabel } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import { formatCurrency, timeAgo, formatVariationId } from '../../src/utils/helpers';
import { exportProjectBatchPDF } from '../../src/services/pdfExport';
import { useAppMode } from '../../src/contexts/AppModeContext';

const STATUS_FILTERS = [
  { value: undefined, label: 'All' },
  { value: VariationStatus.CAPTURED, label: 'Draft' },
  { value: VariationStatus.SUBMITTED, label: 'Submitted' },
  { value: VariationStatus.APPROVED, label: 'Approved' },
  { value: VariationStatus.DISPUTED, label: 'Disputed' },
  { value: VariationStatus.PAID, label: 'Paid' },
];

export default function ProjectDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isOffice } = useAppMode();
  const [project, setProject] = useState<Project | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [statusFilter, setStatusFilter] = useState<VariationStatus | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await getProjectById(id);
    setProject(p);
    const v = await getVariationsForProject(id, statusFilter);
    // Field mode: only show Draft and Submitted variations
    const filtered = isOffice
      ? v
      : v.filter(item => item.status === VariationStatus.CAPTURED || item.status === VariationStatus.SUBMITTED);
    setVariations(filtered);
  }, [id, statusFilter, isOffice]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleBatchExport = async () => {
    setExporting(true);
    try {
      // Always fetch ALL variations for the project regardless of current filter
      const allVariations = await getVariationsForProject(id!);
      if (allVariations.length === 0) {
        Alert.alert('No Variations', 'Nothing to export.');
        return;
      }
      const details: VariationDetail[] = [];
      for (const v of allVariations) {
        const detail = await getVariationDetail(v.id);
        if (detail) details.push(detail);
      }
      await exportProjectBatchPDF(project?.name || 'Project', details);
    } catch (error) {
      Alert.alert('Error', 'Batch export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteProject = () => {
    Alert.alert(
      'Delete Project',
      `Delete "${project?.name}" and all its variations? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProject(id!);
            router.back();
          },
        },
      ],
    );
  };

  const totalValue = variations.reduce((s, v) => s + v.estimatedValue, 0);

  const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLeft: { flex: 1 },
  projectTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  projectMeta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  summaryLabel: { ...typography.overline, color: colors.textMuted },
  summaryValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  summaryActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center' as const, justifyContent: 'center' as const },
  fieldCaptureRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  filterRow: { flexDirection: 'row', padding: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { ...typography.caption, color: colors.textSecondary },
  filterChipTextActive: { color: colors.textInverse, fontWeight: '700' },
  list: { padding: spacing.lg, paddingBottom: 100 },
  variationCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  variationCardPressed: { borderColor: colors.accent },
  variationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  variationSeq: { ...typography.overline, color: colors.accent },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700', color: colors.textInverse, textTransform: 'uppercase' as const },
  variationTitle: { ...typography.labelMedium, color: colors.text },
  variationFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  variationValue: { ...typography.labelMedium, color: colors.text, fontWeight: '800' },
  variationTime: { ...typography.caption, color: colors.textMuted },
  empty: { alignItems: 'center' as const, paddingTop: 80 },
  emptyText: { ...typography.bodyMedium, color: colors.textMuted, marginTop: spacing.md },
  bottomAction: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  newVarButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button },
  newVarButtonPressed: { backgroundColor: colors.accentHover },
  newVarButtonText: { ...typography.labelLarge, color: colors.textInverse },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menuCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, width: 280, overflow: 'hidden' as const },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  menuItemText: { ...typography.labelMedium, color: colors.text },
  menuDivider: { height: 1, backgroundColor: colors.border },
  });

  const renderVariation = ({ item, index }: { item: Variation; index: number }) => (
    <Pressable
      onPress={() => router.push(`/variation/${item.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed
          ? `${colors.accent}10`
          : index % 2 === 0 ? colors.surface : `${colors.border}30`,
        alignItems: 'center',
      })}
    >
      <Text style={{ width: 56, fontSize: 12, fontWeight: '700', color: colors.accent }}>
        {formatVariationId(item.sequenceNumber)}
      </Text>
      <Text style={{ flex: 2, fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
        {item.title}
      </Text>
      <View style={{ flex: 1 }}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status), alignSelf: 'flex-start' }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      {isOffice && (
        <Text style={{ width: 100, fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'right' }}>
          {formatCurrency(item.estimatedValue)}
        </Text>
      )}
      <Text style={{ width: 80, fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>
        {timeAgo(item.capturedAt)}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '' }} />
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryLeft}>
          <Text style={styles.projectTitle} numberOfLines={1}>{project?.name}</Text>
          <Text style={styles.projectMeta} numberOfLines={1}>{project?.client} · {project?.reference}</Text>
          <Text style={styles.summaryLabel}>{isOffice ? 'TOTAL VALUE' : 'VARIATIONS'}</Text>
          <Text style={styles.summaryValue}>{isOffice ? formatCurrency(totalValue) : `${variations.filter(v => v.status === VariationStatus.CAPTURED || v.status === VariationStatus.SUBMITTED).length}`}</Text>
        </View>
        {isOffice && (
          <View style={styles.summaryActions}>
            <Pressable style={styles.iconButton} onPress={handleBatchExport} disabled={exporting}>
              <Ionicons name="document-text-outline" size={22} color={colors.accent} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Filter Row + New Variation (top, small) */}
      <View style={[styles.filterRow, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', flex: 1 }}>
          {STATUS_FILTERS
            .filter(f => isOffice || f.value === undefined || f.value === VariationStatus.CAPTURED || f.value === VariationStatus.SUBMITTED)
            .map((f) => (
              <Pressable
                key={f.label}
                style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
                onPress={() => setStatusFilter(f.value)}
              >
                <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
        </View>
        <Pressable
          onPress={() => router.push(`/capture/${id}`)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: borderRadius.full,
            backgroundColor: colors.accent,
            opacity: pressed ? 0.85 : 1,
            marginLeft: spacing.sm,
          })}
        >
          <Ionicons name="add" size={15} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>New Variation</Text>
        </Pressable>
      </View>

      {/* Table header */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: `${colors.border}50`,
      }}>
        <Text style={{ width: 56, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>#</Text>
        <Text style={{ flex: 2, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title</Text>
        <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</Text>
        {isOffice && <Text style={{ width: 100, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Value</Text>}
        <Text style={{ width: 80, fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Age</Text>
      </View>

      {/* Variation List */}
      <FlatList
        data={variations}
        renderItem={renderVariation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={[styles.empty, { paddingTop: 60 }]}>
            <Ionicons name="layers-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No variations{statusFilter ? ` — filter: ${getStatusLabel(statusFilter)}` : ''}</Text>
          </View>
        }
      />

      {/* Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); handleBatchExport(); }}>
              <Ionicons name="download-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>{exporting ? 'Exporting...' : 'Export All as PDF'}</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); handleDeleteProject(); }}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete Project</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
