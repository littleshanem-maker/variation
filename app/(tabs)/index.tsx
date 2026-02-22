/**
 * Home Screen - Projects List (Field Mode) / Dashboard (Office Mode)
 */

import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getActiveProjects } from '../../src/db/projectRepository';
import { ProjectSummary } from '../../src/types';
import { spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import { formatCurrency, timeAgo } from '../../src/utils/helpers';
import { useConnectivity } from '../../src/hooks/useConnectivity';
import { useAppMode } from '../../src/contexts/AppModeContext';
import { OfficeDashboard } from '../../src/components/OfficeDashboard';

export default function HomeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const isConnected = useConnectivity();
  const { isOffice, mode } = useAppMode();

  const loadProjects = useCallback(async () => {
    try {
      const data = await getActiveProjects();
      setProjects(data);
    } catch (error) {
      console.error('[Projects] Failed to load:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  // Office mode renders the dashboard
  if (isOffice) {
    return <OfficeDashboard />;
  }

  // Field mode renders the project list
  const renderProject = ({ item }: { item: ProjectSummary }) => (
    <Pressable
      style={({ pressed }) => [
        styles.projectCard,
        pressed && styles.projectCardPressed,
      ]}
      onPress={() => router.push(`/project/${item.id}`)}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectInfo}>
          <Text style={styles.projectName}>{item.name}</Text>
          <Text style={styles.projectClient}>
            {item.client} {'\u00B7'} {item.reference}
          </Text>
        </View>
      </View>

      <View style={styles.projectStats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>VARIATIONS</Text>
          <Text style={styles.statValue}>{isOffice ? item.variationCount : item.fieldVariationCount}</Text>
        </View>
        <View style={[styles.stat, styles.statRight]}>
          <Text style={styles.statLabel}>LAST CAPTURE</Text>
          <Text style={styles.statTime}>
            {item.lastCaptureAt ? timeAgo(item.lastCaptureAt) : 'None'}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.connectivityBadge}>
        <View
          style={[
            styles.connectivityDot,
            { backgroundColor: isConnected ? colors.success : colors.accent },
          ]}
        />
        <Text
          style={[
            styles.connectivityText,
            { color: isConnected ? colors.success : colors.accent },
          ]}
        >
          {isConnected ? 'Online' : 'Offline'}
        </Text>
      </View>
      <View style={styles.modeBadge}>
        <Ionicons name={isOffice ? 'briefcase' : 'hammer'} size={12} color={isOffice ? colors.info : colors.accent} />
        <Text style={[styles.modeText, { color: isOffice ? colors.info : colors.accent }]}>
          {isOffice ? 'Office' : 'Field'}
        </Text>
      </View>
    </View>
  );

  const EmptyState = () => (
    <View style={styles.empty}>
      <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No projects yet</Text>
      <Text style={styles.emptyText}>
        Create your first project to start capturing variations.
      </Text>
    </View>
  );

  const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  screenHeader: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.bg },
  screenTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  list: { paddingHorizontal: 12, paddingBottom: 100 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  connectivityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  connectivityDot: { width: 6, height: 6, borderRadius: 3 },
  connectivityText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeText: { fontSize: 12, fontWeight: '500' },
  projectCard: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3, elevation: 2 },
  projectCardPressed: { backgroundColor: colors.surfaceAlt },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  projectInfo: { flex: 1 },
  projectName: { fontSize: 15, fontWeight: '600', color: colors.text },
  projectClient: { fontSize: 13, fontWeight: '400', color: colors.textMuted, marginTop: 2 },
  projectStats: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  stat: { marginRight: spacing.lg },
  statRight: { marginLeft: 'auto', marginRight: 0, alignItems: 'flex-end' as const },
  statLabel: { fontSize: 11, fontWeight: '500', color: colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' as const },
  statValue: { fontSize: 16, fontWeight: '500', color: colors.text, marginTop: 2 },
  statDanger: { color: colors.danger },
  statTime: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center' as const, paddingTop: 80, paddingHorizontal: spacing.xxl },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: spacing.lg },
  emptyText: { fontSize: 14, fontWeight: '400', color: colors.textMuted, textAlign: 'center' as const, marginTop: spacing.sm, lineHeight: 21 },
  bottomAction: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  newProjectButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14, minHeight: touchTargets.button },
  newProjectButtonPressed: { backgroundColor: colors.accentHover },
  newProjectButtonText: { fontSize: 15, fontWeight: '600', color: colors.textInverse },
  });

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Projects</Text>
      </View>
      <FlatList
        data={projects}
        renderItem={renderProject}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      />
    </View>
  );
}
