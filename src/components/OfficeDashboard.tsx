/**
 * Office Dashboard Component
 * 
 * Executive dashboard for office mode showing business intelligence:
 * - Dashboard stats (4 key metrics)
 * - Recent activity
 * - Projects overview
 * - Quick actions
 */

import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats, getActiveProjects } from '../db/projectRepository';
import { getRecentVariations, getVariationsByStatus } from '../db/variationRepository';
import { ProjectSummary, VariationDetail } from '../types/domain';
import { formatCurrency, timeAgo } from '../utils/helpers';
import { getStatusLabel } from '../theme';
import { useThemeColors } from '../contexts/AppModeContext';

// Office mode status colors (different from field theme)
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

export function OfficeDashboard() {
  const colors = useThemeColors();
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
    },
    
    // Stats — 2x2 grid
    statsGrid: {
      paddingHorizontal: 20,
      marginBottom: 32,
      gap: 12,
    },
    statsGridRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
    },
    statSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
    },

    // Sections
    section: {
      paddingHorizontal: 20,
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    
    // Recent Activity
    recentList: {},
    recentItem: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recentItemPressed: {
      borderColor: colors.accent,
    },
    recentContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    recentLeft: {
      flex: 1,
      marginRight: 12,
    },
    recentRight: {
      alignItems: 'flex-end',
    },
    recentTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    recentProject: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 8,
    },
    recentMeta: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    recentValue: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#ffffff',
    },
    recentTime: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },

    // Projects Overview
    projectsList: {},
    projectRow: {
      gap: 12,
    },
    projectOverviewCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    projectOverviewCardPressed: {
      borderColor: colors.accent,
    },
    projectOverviewName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    projectOverviewClient: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 12,
    },
    projectOverviewStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    projectOverviewStat: {
      fontSize: 12,
      color: colors.textMuted,
    },
    projectOverviewValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    atRiskIndicator: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    atRiskText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.warning,
    },

    // Quick Actions
    captureRow: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    captureButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      minHeight: 48,
    },
    captureButtonPressed: {
      backgroundColor: colors.accentHover,
    },
    captureButtonText: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.textInverse,
    },
    captureButtonSecondary: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      backgroundColor: 'transparent',
      borderRadius: 12,
      paddingVertical: 14,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    captureButtonSecondaryText: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.text,
    },
    drilldownContainer: { flex: 1, backgroundColor: colors.bg },
    drilldownHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
    drilldownTitle: { fontSize: 18, fontWeight: '800' as const, color: colors.text, flex: 1 },
    drilldownClose: { padding: 4 },
    drilldownEmpty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 12 },
    drilldownEmptyText: { fontSize: 15, color: colors.textMuted },
    drilldownItem: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderWidth: 1, borderColor: colors.border },
    drilldownItemLeft: { flex: 1, marginRight: 12 },
    drilldownItemTitle: { fontSize: 15, fontWeight: '600' as const, color: colors.text },
    drilldownItemProject: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    drilldownItemRight: { alignItems: 'flex-end' as const },
    drilldownItemValue: { fontSize: 15, fontWeight: '800' as const },
    drilldownItemStatus: { fontSize: 10, color: colors.textMuted, marginTop: 2, letterSpacing: 0.5 },
    quickActions: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 8,
      gap: 8,
    },
    actionButtonPrimary: {
      backgroundColor: colors.accent,
    },
    actionButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionButtonPressed: {
      opacity: 0.8,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },

    // Empty States
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
    },
  });

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
  const [refreshing, setRefreshing] = useState(false);
  const [drilldown, setDrilldown] = useState<{ title: string; items: VariationDetail[] } | null>(null);

  const openDrilldown = async (title: string, statuses: string[]) => {
    const items = await getVariationsByStatus(statuses);
    setDrilldown({ title, items });
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const [statsData, recentData, projectsData] = await Promise.all([
        getDashboardStats(),
        getRecentVariations(10),
        getActiveProjects(),
      ]);
      
      setStats(statsData);
      setRecentVariations(recentData);
      setProjects(projectsData);
    } catch (error) {
      console.error('[OfficeDashboard] Failed to load:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const approvalRate = stats.totalWithOutcome > 0
    ? Math.round((stats.approvedCount / stats.totalWithOutcome) * 100) 
    : 0;

  const renderStatCard = (title: string, value: string | number, subtitle?: string, color?: string, onPress?: () => void) => (
    <Pressable
      style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      {onPress && <Text style={[styles.statSubtitle, { color: colors.accent, marginTop: 4, fontSize: 10 }]}>Tap to view →</Text>}
    </Pressable>
  );

  const renderRecentVariation = ({ item }: { item: VariationDetail }) => (
    <Pressable
      style={({ pressed }) => [
        styles.recentItem,
        pressed && styles.recentItemPressed,
      ]}
      onPress={() => router.push(`/variation/${item.id}`)}
    >
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
  );

  const renderProjectOverview = ({ item }: { item: ProjectSummary }) => (
    <Pressable
      style={({ pressed }) => [
        styles.projectOverviewCard,
        pressed && styles.projectOverviewCardPressed,
      ]}
      onPress={() => router.push(`/project/${item.id}`)}
    >
      <Text style={styles.projectOverviewName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.projectOverviewClient}>{item.client}</Text>
      <View style={styles.projectOverviewStats}>
        <Text style={styles.projectOverviewStat}>{item.variationCount} {item.variationCount === 1 ? 'Variation' : 'Variations'}</Text>
        <Text style={styles.projectOverviewValue}>{formatCurrency(item.totalValue)}</Text>
      </View>
      {item.atRiskValue > 0 && (
        <View style={styles.atRiskIndicator}>
          <Text style={styles.atRiskText}>At Risk: {formatCurrency(item.atRiskValue)}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Business Intelligence Overview</Text>
        </View>

        {/* Stats Grid — 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statsGridRow}>
            {renderStatCard('Approved Value', formatCurrency(stats.approvedValue), 'Confirmed wins', colors.success, () => openDrilldown('Approved Variations', ['approved', 'paid']))}
            {renderStatCard('In Flight', formatCurrency(stats.inFlightValue), `${stats.submittedCount} submitted`, colors.info, () => openDrilldown('In Flight — Awaiting Approval', ['submitted']))}
          </View>
          <View style={styles.statsGridRow}>
            {renderStatCard('Disputed', formatCurrency(stats.disputedValue), 'Being contested', colors.warning, () => openDrilldown('Disputed Variations', ['disputed']))}
            {renderStatCard('Win Rate', `${approvalRate}%`, `${stats.approvedCount} approved`, colors.success)}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.captureRow}>
          <Pressable
            style={({ pressed }) => [styles.captureButtonSecondary, pressed && { opacity: 0.75 }]}
            onPress={() => router.push('/project/new')}
          >
            <Ionicons name="folder-open-outline" size={20} color={colors.text} />
            <Text style={styles.captureButtonSecondaryText}>New Project</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.captureButton, pressed && styles.captureButtonPressed]}
            onPress={() => {
              if (projects.length === 0) {
                Alert.alert('No Projects', 'Create a project first before capturing a variation.');
              } else if (projects.length === 1) {
                router.push(`/capture/${projects[0].id}`);
              } else {
                Alert.alert(
                  'Select Project',
                  'Which project is this variation for?',
                  [
                    ...projects.map(p => ({
                      text: p.name,
                      onPress: () => router.push(`/capture/${p.id}`),
                    })),
                    { text: 'Cancel', style: 'cancel' as const },
                  ],
                );
              }
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.textInverse} />
            <Text style={styles.captureButtonText}>New Variation</Text>
          </Pressable>
        </View>

        {/* Projects Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects Overview</Text>
          {projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active projects</Text>
            </View>
          ) : (
            <View style={styles.projectsList}>
              {projects.reduce((rows: ProjectSummary[][], item, index) => {
                if (index % 2 === 0) rows.push([item]);
                else rows[rows.length - 1].push(item);
                return rows;
              }, []).map((row, rowIndex) => (
                <View key={rowIndex} style={styles.projectRow}>
                  {row.map((item) => renderProjectOverview({ item }))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentVariations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recent variations</Text>
            </View>
          ) : (
            <View style={styles.recentList}>
              {recentVariations.map((item) => renderRecentVariation({ item }))}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Drilldown Modal */}
      <Modal visible={!!drilldown} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.drilldownContainer}>
          <View style={styles.drilldownHeader}>
            <Text style={styles.drilldownTitle}>{drilldown?.title}</Text>
            <Pressable onPress={() => setDrilldown(null)} style={styles.drilldownClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {drilldown?.items.length === 0 ? (
            <View style={styles.drilldownEmpty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
              <Text style={styles.drilldownEmptyText}>No variations in this category</Text>
            </View>
          ) : (
            <FlatList
              data={drilldown?.items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.drilldownItem, pressed && { opacity: 0.75 }]}
                  onPress={() => { setDrilldown(null); router.push(`/variation/${item.id}`); }}
                >
                  <View style={styles.drilldownItemLeft}>
                    <Text style={styles.drilldownItemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.drilldownItemProject}>{item.projectName}</Text>
                  </View>
                  <View style={styles.drilldownItemRight}>
                    <Text style={[styles.drilldownItemValue, { color: colors.accent }]}>{formatCurrency(item.estimatedValue)}</Text>
                    <Text style={styles.drilldownItemStatus}>{item.status.toUpperCase()}</Text>
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