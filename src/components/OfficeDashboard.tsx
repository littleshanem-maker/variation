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
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats, getActiveProjects } from '../db/projectRepository';
import { getRecentVariations } from '../db/variationRepository';
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
  totalVariations: number;
  totalValue: number;
  atRiskValue: number;
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
    totalVariations: 0,
    totalValue: 0,
    atRiskValue: 0,
    approvedCount: 0,
    totalWithOutcome: 0,
  });
  const [recentVariations, setRecentVariations] = useState<VariationDetail[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const renderStatCard = (title: string, value: string | number, subtitle?: string, color?: string) => (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
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
        <Text style={styles.projectOverviewStat}>{item.variationCount} vars</Text>
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
            {renderStatCard('Total Variations', stats.totalVariations)}
            {renderStatCard('Total Value', formatCurrency(stats.totalValue))}
          </View>
          <View style={styles.statsGridRow}>
            {renderStatCard('At Risk', formatCurrency(stats.atRiskValue), undefined, colors.warning)}
            {renderStatCard('Approval Rate', `${approvalRate}%`, `${stats.approvedCount} approved`, colors.success)}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentVariations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recent variations</Text>
            </View>
          ) : (
            <FlatList
              data={recentVariations}
              renderItem={renderRecentVariation}
              keyExtractor={(item) => item.id}
              style={styles.recentList}
            />
          )}
        </View>

        {/* Projects Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects Overview</Text>
          {projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active projects</Text>
            </View>
          ) : (
            <FlatList
              data={projects}
              renderItem={renderProjectOverview}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.projectRow}
              style={styles.projectsList}
            />
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonSecondary,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={() => router.push('/project/new')}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
            <Text style={styles.actionButtonText}>New Project</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonPrimary,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={() => {
              // For now, navigate to first project's capture or show project picker
              if (projects.length > 0) {
                router.push(`/capture/${projects[0].id}`);
              } else {
                router.push('/project/new');
              }
            }}
          >
            <Ionicons name="camera" size={24} color={colors.text} />
            <Text style={styles.actionButtonText}>Capture Variation</Text>
          </Pressable>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}