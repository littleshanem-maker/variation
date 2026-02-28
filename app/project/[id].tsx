/**
 * Project Detail — Variation Register
 */

import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert, Modal, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProjectById, deleteProject, archiveProject } from '../../src/db/projectRepository';
import { getVariationsForProject, getVariationDetail } from '../../src/db/variationRepository';
import { getNoticesForProject } from '../../src/db/noticeRepository';
import { Project, Variation, VariationNotice, VariationStatus, VariationDetail } from '../../src/types/domain';
import { spacing, borderRadius, typography, getStatusColor, getStatusLabel } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import { formatCurrency, timeAgo, formatVariationId } from '../../src/utils/helpers';
import { exportProjectBatchPDF, printRegisterWeb, printProjectDetailedWeb } from '../../src/services/pdfExport';
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
  const [notices, setNotices] = useState<VariationNotice[]>([]);
  const [statusFilter, setStatusFilter] = useState<VariationStatus | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await getProjectById(id);
    setProject(p);
    const v = await getVariationsForProject(id, statusFilter);
    const filtered = isOffice
      ? v
      : v.filter(item => item.status === VariationStatus.CAPTURED || item.status === VariationStatus.SUBMITTED);
    setVariations(filtered);
    const n = await getNoticesForProject(id);
    setNotices(n);
  }, [id, statusFilter, isOffice]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toVariationDetails = (): VariationDetail[] =>
    variations.map(v => ({
      ...v,
      projectName: project?.name ?? '',
      photos: [],
      voiceNotes: [],
      statusHistory: [],
    }));

  const handleExportPDF = async () => {
    if (Platform.OS === 'web') {
      const allV = await getVariationsForProject(id!);
      const details = allV.map(v => ({
        ...v, projectName: project?.name ?? '', photos: [], voiceNotes: [], statusHistory: [],
      }));
      printProjectDetailedWeb(project?.name ?? 'Project', details);
      return;
    }
    setExporting(true);
    try {
      const allVariations = await getVariationsForProject(id!);
      if (allVariations.length === 0) { Alert.alert('No Variations', 'Nothing to export.'); return; }
      const details: VariationDetail[] = [];
      for (const v of allVariations) {
        const detail = await getVariationDetail(v.id);
        if (detail) details.push(detail);
      }
      await exportProjectBatchPDF(project?.name || 'Project', details);
    } catch {
      Alert.alert('Error', 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (Platform.OS !== 'web') return;
    setPrinting(true);
    try {
      const allV = await getVariationsForProject(id!);
      const details = allV.map(v => ({
        ...v, projectName: project?.name ?? '', photos: [], voiceNotes: [], statusHistory: [],
      }));
      printRegisterWeb(details);
    } catch (e) {
      console.error('[Print]', e);
    } finally {
      setPrinting(false);
    }
  };

  const handleDeleteProject = () => {
    Alert.alert(
      'Delete Project',
      `Delete "${project?.name}" and all its variations? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteProject(id!); router.back(); } },
      ],
    );
  };

  const handleArchiveProject = () => {
    Alert.alert(
      'Archive Project',
      `Archive "${project?.name}"? It will be hidden from your project list but can be restored later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', onPress: async () => { await archiveProject(id!); router.back(); } },
      ],
    );
  };

  const totalValue = variations.reduce((s, v) => s + v.estimatedValue, 0);
  const isWeb = Platform.OS === 'web';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    // Summary bar — project info only (no value)
    summaryBar: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: 14,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    summaryLeft: { flex: 1 },
    projectTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    projectMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    // Top-right action buttons
    actionButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 8, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
    deleteBtn: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    // Filter row
    filterRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.bg,
    },
    filterChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
    filterChip: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    filterChipTextActive: { color: '#fff' },
    newVarBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full,
      backgroundColor: colors.accent, marginLeft: 8,
    },
    newVarBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    // Table header
    tableHeader: {
      flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: 9,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: `${colors.border}50`,
    },
    tableHeaderText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    // Status badge
    statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
    // Total footer
    totalRow: {
      flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderTopWidth: 2, borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    totalLabel: { flex: 3, fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'right', paddingRight: 12 },
    totalValue: { width: 110, fontSize: 15, fontWeight: '900', color: colors.text, textAlign: 'right' },
    totalSpacer: { width: 90 },
    // Empty
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
    // Notices row
    noticesRow: {
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.bg,
    },
    noticesLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 7 },
    noticesPills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    noticePill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    noticePillText: { fontSize: 12, fontWeight: '700', color: colors.text },
    newNoticeSmallBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full,
      borderWidth: 1, borderColor: colors.warning ?? '#C8943E',
    },
    newNoticeSmallText: { fontSize: 12, fontWeight: '700', color: colors.warning ?? '#C8943E' },
    // Mobile
    iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    menuCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, width: 260, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
    menuItemText: { ...typography.labelMedium, color: colors.text },
    menuDivider: { height: 1, backgroundColor: colors.border },
    bottomAction: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
    captureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 14 },
    captureBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });

  const renderVariation = ({ item, index }: { item: Variation; index: number }) => (
    <Pressable
      onPress={() => router.push(`/variation/${item.id}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed
          ? `${colors.accent}10`
          : index % 2 === 0 ? 'transparent' : `${colors.border}30`,
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
        <Text style={{ width: 110, fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'right' }}>
          {formatCurrency(item.estimatedValue)}
        </Text>
      )}
      <Text style={{ width: 90, fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>
        {timeAgo(item.capturedAt)}
      </Text>
    </Pressable>
  );

  const ListFooter = () => (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>Total</Text>
      {isOffice && <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>}
      <View style={styles.totalSpacer} />
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '' }} />

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryLeft}>
          <Text style={styles.projectTitle} numberOfLines={1}>{project?.name}</Text>
          <Text style={styles.projectMeta}>{project?.client}{project?.reference ? ` · ${project.reference}` : ''}</Text>
        </View>

        {isWeb ? (
          /* Desktop: labeled buttons */
          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { opacity: pressed || exporting ? 0.7 : 1 }]}
              onPress={handleExportPDF}
              disabled={exporting}
            >
              <Ionicons name="document-text-outline" size={15} color={colors.accent} />
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>
                {exporting ? 'Loading…' : 'Export PDF'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { opacity: pressed || printing ? 0.7 : 1 }]}
              onPress={handlePrint}
              disabled={printing}
            >
              <Ionicons name="print-outline" size={15} color={colors.text} />
              <Text style={styles.actionBtnText}>{printing ? 'Loading…' : 'Print'}</Text>
            </Pressable>
            <Pressable
              style={styles.deleteBtn}
              onPress={handleDeleteProject}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </View>
        ) : (
          /* Mobile: icon buttons */
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.iconButton} onPress={handleExportPDF} disabled={exporting}>
              <Ionicons name="document-text-outline" size={20} color={colors.accent} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Filter Row + New Variation */}
      <View style={styles.filterRow}>
        <View style={styles.filterChips}>
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
          style={({ pressed }) => [styles.newVarBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="add" size={15} color="#fff" />
          <Text style={styles.newVarBtnText}>New Variation</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/notice/new?projectId=${id}`)}
          style={({ pressed }) => [
            styles.newVarBtn,
            { opacity: pressed ? 0.85 : 1, backgroundColor: colors.warning ?? '#C8943E', marginLeft: 4 },
          ]}
        >
          <Ionicons name="warning-outline" size={15} color="#fff" />
          <Text style={styles.newVarBtnText}>Notice</Text>
        </Pressable>
      </View>

      {/* Notices Row */}
      {notices.length > 0 ? (
        <View style={styles.noticesRow}>
          <Text style={styles.noticesLabel}>Notices</Text>
          <View style={styles.noticesPills}>
            {notices.map((n) => (
              <Pressable
                key={n.id}
                style={({ pressed }) => [styles.noticePill, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => router.push(`/notice/${n.id}`)}
              >
                <Text style={styles.noticePillText}>{n.noticeNumber}</Text>
                <Text style={{ fontSize: 11, color: n.status === 'issued' ? colors.warning ?? '#C8943E' : n.status === 'acknowledged' ? colors.success : colors.textMuted }}>
                  {n.status === 'issued' ? '✓' : n.status === 'acknowledged' ? '✓✓' : '○'}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.newNoticeSmallBtn, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => router.push(`/notice/new?projectId=${id}`)}
            >
              <Ionicons name="add" size={13} color={colors.warning ?? '#C8943E'} />
              <Text style={styles.newNoticeSmallText}>New</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { width: 56 }]}>#</Text>
        <Text style={[styles.tableHeaderText, { flex: 2 }]}>Title</Text>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
        {isOffice && <Text style={[styles.tableHeaderText, { width: 110, textAlign: 'right' }]}>Value</Text>}
        <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'right' }]}>Age</Text>
      </View>

      {/* Variation List */}
      <FlatList
        data={variations}
        renderItem={renderVariation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListFooterComponent={variations.length > 0 ? ListFooter : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="layers-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              No variations{statusFilter ? ` — ${getStatusLabel(statusFilter)}` : ''}
            </Text>
          </View>
        }
      />

      {/* Field mode: New Variation + New Notice bottom buttons */}
      {!isOffice && (
        <View style={styles.bottomAction}>
          <Pressable
            style={({ pressed }) => [styles.captureBtn, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push(`/capture/${id}`)}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.captureBtnText}>New Variation</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.captureBtn,
              { opacity: pressed ? 0.85 : 1, backgroundColor: colors.warning ?? '#C8943E', marginTop: 10 },
            ]}
            onPress={() => router.push(`/notice/new?projectId=${id}`)}
          >
            <Ionicons name="warning-outline" size={22} color="#fff" />
            <Text style={styles.captureBtnText}>New Notice</Text>
          </Pressable>
        </View>
      )}

      {/* Mobile menu */}
      <Modal visible={showMenu} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); handleExportPDF(); }}>
              <Ionicons name="download-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>{exporting ? 'Exporting...' : 'Export All as PDF'}</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); handleArchiveProject(); }}>
              <Ionicons name="archive-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.menuItemText, { color: colors.textMuted }]}>Archive Project</Text>
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
