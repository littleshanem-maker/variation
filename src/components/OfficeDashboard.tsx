/**
 * Office Dashboard Component
 *
 * Mobile: Scrollable card layout (existing)
 * Web/Desktop: Full sidebar + data table layout
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  Modal,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats, getActiveProjects } from '../db/projectRepository';
import { getRecentVariations, getVariationsByStatus, getVariationStatusSummary, getAllVariationsForRegister, VariationStatusSummary } from '../db/variationRepository';
import { printRegisterWeb } from '../services/pdfExport';
import { ProjectSummary, VariationDetail } from '../types/domain';
import { formatCurrency, timeAgo } from '../utils/helpers';
import { getStatusLabel } from '../theme';
import { useThemeColors } from '../contexts/AppModeContext';

const getOfficeStatusColor = (status: string, colors: any): string => {
  const statusColors: Record<string, string> = {
    captured: colors.warning,
    submitted: colors.accent,
    approved: colors.success,
    disputed: colors.danger,
    paid: colors.text,
  };
  return statusColors[status] ?? colors.textMuted;
};

interface DashboardStats {
  approvedValue: number;
  inFlightValue: number;
  disputedValue: number;
  submittedCount: number;
  approvedCount: number;
  totalWithOutcome: number;
}

type NavSection = 'dashboard' | 'settings';

// ─────────────────────────────────────────────
// DESKTOP LAYOUT
// ─────────────────────────────────────────────
function DesktopDashboard({
  recentVariations,
  projects,
  statusSummary,
  refreshing,
  onRefresh,
  openDrilldown,
  drilldown,
  setDrilldown,
  onPrintRegister,
  printing,
}: any) {
  const colors = useThemeColors();
  const router = useRouter();
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');

  const navItems: { key: NavSection; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home-outline' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];

  const statusBadgeStyle = (status: string) => ({
    display: 'inline-flex' as any,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: getOfficeStatusColor(status, colors),
    alignSelf: 'flex-start' as any,
  });

  // Status card config — matches the old stat-card style
  const statusFilters = [
    { key: 'draft',     label: 'Draft',      statuses: ['captured'],  color: colors.warning, sub: (s: VariationStatusSummary|undefined) => `${s?.count ?? 0} variation${(s?.count ?? 0) !== 1 ? 's' : ''}` },
    { key: 'submitted', label: 'Submitted',   statuses: ['submitted'], color: colors.accent,  sub: (s: VariationStatusSummary|undefined) => `${s?.count ?? 0} waiting` },
    { key: 'approved',  label: 'Approved',    statuses: ['approved'],  color: colors.success, sub: (s: VariationStatusSummary|undefined) => `${s?.count ?? 0} approved` },
    { key: 'paid',      label: 'Paid',        statuses: ['paid'],      color: '#6366f1',      sub: (s: VariationStatusSummary|undefined) => `${s?.count ?? 0} settled` },
    { key: 'disputed',  label: 'Disputed',    statuses: ['disputed'],  color: colors.danger,  sub: (s: VariationStatusSummary|undefined) => `${s?.count ?? 0} contested` },
    { key: 'at-risk',   label: 'At Risk',     statuses: ['disputed'],  color: '#f97316',      sub: (s: VariationStatusSummary|undefined) => `${s?.count ?? 0} at risk` },
  ];

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>

      {/* ── SIDEBAR ── */}
      <View style={{
        width: 220,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        flexDirection: 'column',
        justifyContent: 'space-between',
        paddingVertical: 24,
      }}>
        {/* Logo */}
        <View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 32, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text" size={18} color="#fff" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Variation Shield</Text>
          </View>

          {/* Nav Items */}
          {navItems.map((item) => {
            const isActive = activeNav === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setActiveNav(item.key)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  marginHorizontal: 8,
                  marginBottom: 2,
                  borderRadius: 8,
                  backgroundColor: isActive ? colors.accent : pressed ? colors.border : 'transparent',
                })}
              >
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={isActive ? '#fff' : colors.textMuted}
                />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isActive ? '#fff' : colors.text,
                }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* No bottom actions — use top bar buttons instead */}
        <View />
      </View>

      {/* ── MAIN CONTENT ── */}
      <View style={{ flex: 1, flexDirection: 'column' }}>

        {/* Top Bar */}
        <View style={{
          height: 56,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 32,
          backgroundColor: colors.surface,
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
            Variation Register
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={onPrintRegister}
              disabled={printing}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: pressed ? colors.border : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: printing ? 0.5 : 1,
              })}
            >
              <Ionicons name="print-outline" size={15} color={colors.text} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                {printing ? 'Loading…' : 'Print Register'}
              </Text>
            </Pressable>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: `${colors.accent}20`, borderWidth: 1, borderColor: `${colors.accent}40` }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.accent }}>Office Mode</Text>
            </View>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >

          {/* ── STATUS CARDS (same style, with dollar values) ── */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
            {statusFilters.map((sf) => {
              const match = sf.key === 'draft'
                ? statusSummary.find((s: VariationStatusSummary) => s.status === 'captured')
                : statusSummary.find((s: VariationStatusSummary) => s.status === sf.statuses[0]);
              const value = match?.totalValue ?? 0;
              return (
                <Pressable
                  key={sf.key}
                  onPress={() => openDrilldown(sf.label, sf.statuses)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 140,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 20,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{sf.label}</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: sf.color }}>{formatCurrency(value)}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{sf.sub(match)}</Text>
                  <Text style={{ fontSize: 11, color: colors.accent, marginTop: 6 }}>View details →</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── PROJECTS GRID (3 cols) ── */}
          <View style={{ marginBottom: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Projects</Text>
              <Pressable onPress={() => router.push('/project/new')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 })}>
                <Ionicons name="add" size={16} color={colors.text} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>New Project</Text>
              </Pressable>
            </View>

            {projects.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="folder-open-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 12 }}>No active projects</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {projects.map((item: ProjectSummary) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/project/${item.id}`)}
                    style={({ pressed }) => ({
                      width: 'calc(33.333% - 11px)' as any,
                      minWidth: 240,
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      padding: 20,
                      borderWidth: 1,
                      borderColor: pressed ? colors.accent : colors.border,
                    })}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>{item.client}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>{item.variationCount} variation{item.variationCount !== 1 ? 's' : ''}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{formatCurrency(item.totalValue)}</Text>
                    </View>
                    {item.atRiskValue > 0 && (
                      <View style={{ marginTop: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.warning }}>⚠ At Risk: {formatCurrency(item.atRiskValue)}</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── RECENT ACTIVITY TABLE ── */}
          <View style={{ marginBottom: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Recent Activity</Text>
              <Text style={{ fontSize: 13, color: colors.accent }}>Last 10 variations</Text>
            </View>

            <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {/* Table Header */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: `${colors.border}50` }}>
                {['Title', 'Project', 'Status', 'Value', 'Captured'].map((col, i) => (
                  <Text key={col} style={{
                    flex: i === 0 ? 2 : 1,
                    fontSize: 11,
                    fontWeight: '700',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>{col}</Text>
                ))}
              </View>

              {/* Table Rows */}
              {recentVariations.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted }}>No variations captured yet</Text>
                </View>
              ) : recentVariations.map((item: VariationDetail, idx: number) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/variation/${item.id}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    borderBottomWidth: idx < recentVariations.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    backgroundColor: pressed ? `${colors.accent}10` : idx % 2 === 0 ? 'transparent' : `${colors.border}30`,
                    alignItems: 'center',
                  })}
                >
                  <Text style={{ flex: 2, fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textMuted }} numberOfLines={1}>{item.projectName}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={[statusBadgeStyle(item.status)]}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>{getStatusLabel(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>{formatCurrency(item.estimatedValue)}</Text>
                  <Text style={{ flex: 1, fontSize: 12, color: colors.textMuted }}>{timeAgo(item.capturedAt)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>

      {/* Drilldown Modal */}
      <Modal visible={!!drilldown} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 }}>{drilldown?.title}</Text>
            <Pressable onPress={() => setDrilldown(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {drilldown?.items.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: 15, color: colors.textMuted }}>No variations in this category</Text>
            </View>
          ) : (
            <FlatList
              data={drilldown?.items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.75 : 1 })}
                  onPress={() => { setDrilldown(null); router.push(`/variation/${item.id}`); }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.projectName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accent }}>{formatCurrency(item.estimatedValue)}</Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2, letterSpacing: 0.5 }}>{item.status.toUpperCase()}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────
// MAIN EXPORT — routes to Desktop or Mobile
// ─────────────────────────────────────────────
export function OfficeDashboard() {
  const colors = useThemeColors();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    approvedValue: 0,
    inFlightValue: 0,
    disputedValue: 0,
    submittedCount: 0,
    approvedCount: 0,
    totalWithOutcome: 0,
  });
  const [recentVariations, setRecentVariations] = useState<VariationDetail[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [statusSummary, setStatusSummary] = useState<VariationStatusSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [drilldown, setDrilldown] = useState<{ title: string; items: VariationDetail[] } | null>(null);

  const openDrilldown = async (title: string, statuses: string[]) => {
    const items = await getVariationsByStatus(statuses);
    setDrilldown({ title, items });
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const [statsData, recentData, projectsData, summaryData] = await Promise.all([
        getDashboardStats(),
        getRecentVariations(10),
        getActiveProjects(),
        getVariationStatusSummary(),
      ]);
      setStats(statsData);
      setRecentVariations(recentData);
      setProjects(projectsData);
      setStatusSummary(summaryData);
    } catch (error) {
      console.error('[OfficeDashboard] Failed to load:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDashboardData(); }, [loadDashboardData]));

  const onRefresh = async () => { setRefreshing(true); await loadDashboardData(); setRefreshing(false); };

  const approvalRate = stats.totalWithOutcome > 0
    ? Math.round((stats.approvedCount / stats.totalWithOutcome) * 100)
    : 0;

  const handlePrintRegister = async () => {
    setPrinting(true);
    try {
      const all = await getAllVariationsForRegister();
      printRegisterWeb(all);
    } catch (e) {
      console.error('[Print] failed', e);
    } finally {
      setPrinting(false);
    }
  };

  // ── DESKTOP ──
  if (Platform.OS === 'web') {
    return (
      <DesktopDashboard
        recentVariations={recentVariations}
        projects={projects}
        statusSummary={statusSummary}
        refreshing={refreshing}
        onRefresh={onRefresh}
        openDrilldown={openDrilldown}
        drilldown={drilldown}
        setDrilldown={setDrilldown}
        onPrintRegister={handlePrintRegister}
        printing={printing}
      />
    );
  }

  // ── MOBILE (unchanged) ──
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 24 },
    headerTitle: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
    statsGrid: { paddingHorizontal: 20, marginBottom: 32, gap: 12 },
    statsGridRow: { flexDirection: 'row', gap: 12 },
    statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
    statTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 },
    statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
    statSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    section: { paddingHorizontal: 20, marginBottom: 32 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
    recentItem: { backgroundColor: colors.surface, borderRadius: 8, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    recentItemPressed: { borderColor: colors.accent },
    recentContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    recentLeft: { flex: 1, marginRight: 12 },
    recentRight: { alignItems: 'flex-end' },
    recentTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
    recentProject: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
    recentMeta: { flexDirection: 'row', alignItems: 'center' },
    recentValue: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: '600', color: '#ffffff' },
    recentTime: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    projectOverviewCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    projectOverviewName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
    projectOverviewClient: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
    projectOverviewStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    projectOverviewValue: { fontSize: 14, fontWeight: '700', color: colors.text },
    atRiskIndicator: { backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)', marginTop: 8 },
    atRiskText: { fontSize: 11, fontWeight: '600', color: colors.warning },
    captureRow: { paddingHorizontal: 20, marginBottom: 16 },
    captureButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, minHeight: 48 },
    captureButtonText: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
    captureButtonSecondary: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, borderRadius: 12, paddingVertical: 14, minHeight: 48, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    captureButtonSecondaryText: { fontSize: 15, fontWeight: '700' as const, color: colors.text },
    emptyState: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: colors.textMuted },
    drilldownContainer: { flex: 1, backgroundColor: colors.bg },
    drilldownHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
    drilldownTitle: { fontSize: 18, fontWeight: '800' as const, color: colors.text, flex: 1 },
    drilldownItem: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderWidth: 1, borderColor: colors.border },
  });

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Variation Register</Text>
          <Text style={styles.headerSubtitle}>Business Intelligence Overview</Text>
        </View>
        <View style={styles.statsGrid}>
          {[
            [
              { key: 'draft',     label: 'Draft',     statuses: ['captured'],  color: colors.warning, sub: () => { const s = statusSummary.find((x: VariationStatusSummary) => x.status === 'captured'); return `${s?.count ?? 0} variation${(s?.count ?? 0) !== 1 ? 's' : ''}`; } },
              { key: 'submitted', label: 'Submitted',  statuses: ['submitted'], color: colors.accent,  sub: () => { const s = statusSummary.find((x: VariationStatusSummary) => x.status === 'submitted'); return `${s?.count ?? 0} waiting`; } },
            ],
            [
              { key: 'approved',  label: 'Approved',   statuses: ['approved'],  color: colors.success, sub: () => { const s = statusSummary.find((x: VariationStatusSummary) => x.status === 'approved'); return `${s?.count ?? 0} approved`; } },
              { key: 'paid',      label: 'Paid',       statuses: ['paid'],      color: '#6366f1',      sub: () => { const s = statusSummary.find((x: VariationStatusSummary) => x.status === 'paid'); return `${s?.count ?? 0} settled`; } },
            ],
            [
              { key: 'disputed',  label: 'Disputed',   statuses: ['disputed'],  color: colors.danger,  sub: () => { const s = statusSummary.find((x: VariationStatusSummary) => x.status === 'disputed'); return `${s?.count ?? 0} contested`; } },
              { key: 'at-risk',   label: 'At Risk',    statuses: ['disputed'],  color: '#f97316',      sub: () => { const s = statusSummary.find((x: VariationStatusSummary) => x.status === 'disputed'); return `${s?.count ?? 0} at risk`; } },
            ],
          ].map((row, ri) => (
            <View key={ri} style={styles.statsGridRow}>
              {row.map((sf) => {
                const match = sf.key === 'draft'
                  ? statusSummary.find((s: VariationStatusSummary) => s.status === 'captured')
                  : statusSummary.find((s: VariationStatusSummary) => s.status === sf.statuses[0]);
                const value = match?.totalValue ?? 0;
                return (
                  <Pressable key={sf.key} style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.75 }]} onPress={() => openDrilldown(sf.label, sf.statuses)}>
                    <Text style={styles.statTitle}>{sf.label}</Text>
                    <Text style={[styles.statValue, { color: sf.color }]}>{formatCurrency(value)}</Text>
                    <Text style={styles.statSubtitle}>{sf.sub()}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={styles.captureRow}>
          <Pressable style={[styles.captureButtonSecondary]} onPress={() => router.push('/project/new')}>
            <Ionicons name="folder-open-outline" size={20} color={colors.text} />
            <Text style={styles.captureButtonSecondaryText}>New Project</Text>
          </Pressable>
          <Pressable style={[styles.captureButton]} onPress={() => {
            if (projects.length === 0) { Alert.alert('No Projects', 'Create a project first.'); }
            else if (projects.length === 1) { router.push(`/capture/${projects[0].id}`); }
            else { Alert.alert('Select Project', 'Which project?', [...projects.map(p => ({ text: p.name, onPress: () => router.push(`/capture/${p.id}`) })), { text: 'Cancel', style: 'cancel' as const }]); }
          }}>
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.captureButtonText}>New Variation</Text>
          </Pressable>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {projects.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>No active projects</Text></View> : projects.map(item => (
            <Pressable key={item.id} style={({ pressed }) => [styles.projectOverviewCard, pressed && { borderColor: colors.accent }]} onPress={() => router.push(`/project/${item.id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.projectOverviewName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.projectOverviewClient}>{item.client}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.projectOverviewValue}>{formatCurrency(item.totalValue)}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.variationCount} variation{item.variationCount !== 1 ? 's' : ''}</Text>
                </View>
              </View>
              {item.atRiskValue > 0 && <View style={styles.atRiskIndicator}><Text style={styles.atRiskText}>⚠ At Risk: {formatCurrency(item.atRiskValue)}</Text></View>}
            </Pressable>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentVariations.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyText}>No recent variations</Text></View> : recentVariations.map(item => (
            <Pressable key={item.id} style={({ pressed }) => [styles.recentItem, pressed && styles.recentItemPressed]} onPress={() => router.push(`/variation/${item.id}`)}>
              <View style={styles.recentContent}>
                <View style={styles.recentLeft}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.recentProject}>{item.projectName}</Text>
                  <View style={styles.recentMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: getOfficeStatusColor(item.status, colors) }]}>
                      <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentValue}>{formatCurrency(item.estimatedValue)}</Text>
                  <Text style={styles.recentTime}>{timeAgo(item.capturedAt)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
      <Modal visible={!!drilldown} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.drilldownContainer}>
          <View style={styles.drilldownHeader}>
            <Text style={styles.drilldownTitle}>{drilldown?.title}</Text>
            <Pressable onPress={() => setDrilldown(null)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={drilldown?.items}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <Pressable style={({ pressed }) => [styles.drilldownItem, pressed && { opacity: 0.75 }]} onPress={() => { setDrilldown(null); router.push(`/variation/${item.id}`); }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.projectName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.accent }}>{formatCurrency(item.estimatedValue)}</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2, letterSpacing: 0.5 }}>{item.status.toUpperCase()}</Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
