/**
 * Settings Screen
 *
 * Real functionality:
 * - Sync status with pending count
 * - Reset demo data
 * - Evidence chain info
 * - About / support
 */

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { getDatabase } from '../../src/db/schema';
import { resetAndReseed } from '../../src/db/seedData';
import { useConnectivity } from '../../src/hooks/useConnectivity';

export default function SettingsScreen() {
  const isConnected = useConnectivity();
  const [pendingCount, setPendingCount] = useState(0);
  const [totalVariations, setTotalVariations] = useState(0);
  const [resetting, setResetting] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const db = await getDatabase();
      const pending = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM variations WHERE sync_status = 'pending'",
      );
      const total = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM variations',
      );
      setPendingCount(pending?.count ?? 0);
      setTotalVariations(total?.count ?? 0);
    } catch (e) {
      console.error('[Settings] Failed to load stats:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  const handleResetDemo = () => {
    Alert.alert(
      'Reset Demo Data',
      'This will delete all projects and variations, then reload the demo dataset. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await resetAndReseed();
              await loadStats();
              Alert.alert('Done', 'Demo data has been reset.');
            } catch (error) {
              console.error('[Settings] Reset failed:', error);
              Alert.alert('Error', 'Reset failed. Please try again.');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  const items = [
    {
      icon: 'sync-outline' as const,
      label: 'Sync Status',
      subtitle: isConnected
        ? pendingCount > 0
          ? `${pendingCount} items waiting to sync`
          : 'All data synced'
        : 'Offline — data saved locally',
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Evidence Chain',
      subtitle: `${totalVariations} variations with SHA-256 integrity hashes`,
      onPress: () =>
        Alert.alert(
          'Evidence Chain',
          'Every photo, voice note, and variation record is hashed using SHA-256 at the moment of capture.\n\nThis creates an immutable evidence chain that proves:\n\u2022 When evidence was captured\n\u2022 Where it was captured (GPS)\n\u2022 That files have not been modified\n\nThis makes your variation claims legally defensible in contract disputes.',
        ),
    },
    {
      icon: 'refresh-outline' as const,
      label: 'Reset Demo Data',
      subtitle: 'Reload sample projects and variations',
      onPress: handleResetDemo,
      destructive: true,
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Support',
      subtitle: 'help@variationcapture.com.au',
    },
    {
      icon: 'information-circle-outline' as const,
      label: 'About',
      subtitle: 'Version 1.0.0 (MVP) \u00b7 Pipeline Consulting',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Connection Status */}
      <View style={[styles.connectionBanner, !isConnected && styles.connectionBannerOffline]}>
        <Ionicons
          name={isConnected ? 'cloud-done-outline' : 'cloud-offline-outline'}
          size={18}
          color={isConnected ? colors.success : colors.status.disputed}
        />
        <Text
          style={[
            styles.connectionText,
            { color: isConnected ? colors.success : colors.status.disputed },
          ]}
        >
          {isConnected ? 'Connected' : 'Offline \u2014 data saved locally'}
        </Text>
      </View>

      {/* Menu Items */}
      <View style={styles.card}>
        {items.map((item, index) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
              index === 0 && styles.rowFirst,
              index === items.length - 1 && styles.rowLast,
              index < items.length - 1 && styles.rowBorder,
            ]}
            onPress={item.onPress}
            disabled={resetting && item.label === 'Reset Demo Data'}
          >
            <View style={styles.rowIcon}>
              <Ionicons
                name={item.icon}
                size={22}
                color={item.destructive ? colors.status.disputed : colors.textSecondary}
              />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowLabel,
                  item.destructive && { color: colors.status.disputed },
                ]}
              >
                {item.label === 'Reset Demo Data' && resetting ? 'Resetting...' : item.label}
              </Text>
              <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
            </View>
            {item.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : item.onPress ? (
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            ) : null}
          </Pressable>
        ))}
      </View>

      <Text style={styles.footer}>
        Variation Capture {'\u00b7'} Pipeline Consulting Pty Ltd{'\n'}
        Built for Victorian construction contractors
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  connectionBannerOffline: {
    backgroundColor: colors.dangerLight,
  },
  connectionText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    minHeight: touchTargets.button,
  },
  rowPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  rowFirst: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  rowLast: {
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 32,
    marginRight: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    ...typography.labelMedium,
    color: colors.text,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 11,
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxxl,
    lineHeight: 18,
  },
});
