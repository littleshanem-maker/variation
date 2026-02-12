/**
 * Projects Screen (Home)
 */

import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getActiveProjects } from '../../src/db/projectRepository';
import { ProjectSummary } from '../../src/types';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { formatCurrency, timeAgo } from '../../src/utils/helpers';
import { useConnectivity } from '../../src/hooks/useConnectivity';

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const isConnected = useConnectivity();

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
          <Text style={styles.statValue}>{item.variationCount}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>AT RISK</Text>
          <Text style={[styles.statValue, styles.statDanger]}>
            {formatCurrency(item.atRiskValue)}
          </Text>
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
      <Text style={styles.projectCount}>
        {projects.length} active project{projects.length !== 1 ? 's' : ''}
      </Text>
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

      <View style={styles.bottomAction}>
        <Pressable
          style={({ pressed }) => [
            styles.newProjectButton,
            pressed && styles.newProjectButtonPressed,
          ]}
          onPress={() => router.push('/project/new')}
        >
          <Ionicons name="add" size={24} color={colors.textInverse} />
          <Text style={styles.newProjectButtonText}>New Project</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  screenHeader: { paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.bg },
  screenTitle: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5, textAlign: 'center'},
  list: { padding: spacing.lg, paddingBottom: 100 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  connectivityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  connectivityDot: { width: 8, height: 8, borderRadius: 4 },
  connectivityText: { fontSize: 12, fontWeight: '600' },
  projectCount: { ...typography.caption, color: colors.textMuted },
  projectCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  projectCardPressed: { borderColor: colors.accent },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  projectInfo: { flex: 1 },
  projectName: { ...typography.headingSmall, color: colors.text },
  projectClient: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  projectStats: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: `${colors.border}60` },
  stat: { marginRight: spacing.lg },
  statRight: { marginLeft: 'auto', marginRight: 0, alignItems: 'flex-end' as const },
  statLabel: { ...typography.overline, color: colors.textMuted },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 },
  statDanger: { color: colors.danger },
  statTime: { ...typography.labelMedium, color: colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center' as const, paddingTop: 80, paddingHorizontal: spacing.xxl },
  emptyTitle: { ...typography.headingMedium, color: colors.text, marginTop: spacing.lg },
  emptyText: { ...typography.bodyMedium, color: colors.textMuted, textAlign: 'center' as const, marginTop: spacing.sm },
  bottomAction: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  newProjectButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button },
  newProjectButtonPressed: { backgroundColor: colors.accentHover },
  newProjectButtonText: { ...typography.labelLarge, color: colors.textInverse },
});
