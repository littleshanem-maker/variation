/**
 * Settings Screen — Phase 2
 *
 * Mode toggle (Field/Office), sync status, AI services, demo reset.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ScrollView, Switch, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import { getDatabase } from '../../src/db/schema';
import { resetAndReseed } from '../../src/db/seedData';
import { useConnectivity } from '../../src/hooks/useConnectivity';
import { syncPendingChanges, getPendingSyncCount } from '../../src/services/sync';
import { signUp, signIn, signOut, getCurrentUser, isCloudEnabled } from '../../src/services/auth';
import { config } from '../../src/config';
import { useAppMode } from '../../src/contexts/AppModeContext';

export default function SettingsScreen() {
  const colors = useThemeColors();
  const isConnected = useConnectivity();
  const { mode, isOffice, isField, switchToOffice, switchToField } = useAppMode();
  const [pendingCount, setPendingCount] = useState(0);
  const [totalVariations, setTotalVariations] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authLoading, setAuthLoading] = useState(false);

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
      const user = await getCurrentUser();
      setUserEmail(user?.email ?? null);
    } catch (e) {
      console.error('[Settings] Failed to load stats:', e);
    }
  }, []);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      const result = authMode === 'signup'
        ? await signUp(authEmail, authPassword, authName)
        : await signIn(authEmail, authPassword);
      if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        setUserEmail(result.user?.email ?? null);
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
        Alert.alert('Success', authMode === 'signup' ? 'Account created! Check your email to confirm.' : 'Signed in successfully.');
      }
    } catch (e) {
      Alert.alert('Error', 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUserEmail(null);
    Alert.alert('Signed Out', 'You have been signed out.');
  };

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingChanges();
      if (result.success) {
        Alert.alert('Sync Complete', `Pushed ${result.pushed} items`);
      } else {
        Alert.alert('Sync', result.message || 'Nothing to sync');
      }
      await loadStats();
    } catch (e) {
      Alert.alert('Error', 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleModeToggle = () => {
    if (isOffice) {
      switchToField();
    } else {
      // TODO: Add purchase gate here before enabling Office mode
      switchToOffice('1234');
    }
  };

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
              Alert.alert('Error', 'Reset failed. Please try again.');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  connectionBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successLight, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg },
  connectionBannerOffline: { backgroundColor: colors.dangerLight },
  connectionText: { ...typography.labelSmall, fontWeight: '600' },
  card: { borderRadius: borderRadius.lg, overflow: 'hidden' as const },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.lg, minHeight: touchTargets.button },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowFirst: { borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg },
  rowLast: { borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowHighlight: { backgroundColor: colors.accentLight },
  rowIcon: { width: 32, marginRight: spacing.md },
  rowContent: { flex: 1 },
  rowLabel: { ...typography.labelMedium, color: colors.text },
  rowSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  badge: { backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 6 },
  badgeText: { ...typography.caption, color: colors.textInverse, fontWeight: '700', fontSize: 11 },
  modeToggle: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  modeToggleField: { backgroundColor: colors.accent },
  modeToggleOffice: { backgroundColor: colors.info },
  modeToggleText: { fontSize: 10, fontWeight: '800', color: colors.textInverse, letterSpacing: 0.5 },
  pinHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' as const, marginTop: spacing.md },
  footer: { ...typography.caption, color: colors.textMuted, textAlign: 'center' as const, marginTop: spacing.xxxl, lineHeight: 18 },

  // PIN Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pinCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xxl, width: 300 },
  pinTitle: { ...typography.headingSmall, color: colors.text, textAlign: 'center' as const },
  pinSubtitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center' as const, marginTop: 4, marginBottom: spacing.lg },
  pinInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.lg, fontSize: 24, fontWeight: '800', textAlign: 'center' as const, color: colors.text, letterSpacing: 8 },
  pinError: { ...typography.caption, color: colors.danger, textAlign: 'center' as const, marginTop: spacing.sm },
  pinActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  pinCancel: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const },
  pinCancelText: { ...typography.labelMedium, color: colors.textSecondary },
  pinSubmit: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.lg, backgroundColor: colors.accent, alignItems: 'center' as const },
  pinSubmitText: { ...typography.labelMedium, color: colors.textInverse },
  });

  const items = [
    {
      icon: (userEmail ? 'person-circle' : 'log-in-outline') as 'person-circle' | 'log-in-outline',
      label: userEmail ? `Signed in as ${userEmail}` : 'Sign In / Sign Up',
      subtitle: userEmail ? 'Tap to sign out' : 'Create an account to enable cloud sync',
      onPress: userEmail ? handleSignOut : () => setShowAuthModal(true),
    },
    {
      icon: (isOffice ? 'briefcase' : 'hammer') as 'briefcase' | 'hammer',
      label: isOffice ? 'Office Mode' : 'Field Mode',
      subtitle: isOffice
        ? 'Full access — values, exports, project management'
        : 'Capture only — no values, limited controls',
      highlight: true,
      onPress: handleModeToggle,
    },
    {
      icon: 'cloud-outline' as const,
      label: 'Cloud Sync',
      subtitle: config.supabase.enabled
        ? isConnected
          ? pendingCount > 0 ? `${pendingCount} items waiting to sync` : 'All data synced'
          : 'Offline \u2014 data saved locally'
        : 'Not configured \u2014 local only mode',
      badge: pendingCount > 0 ? pendingCount : undefined,
      onPress: config.supabase.enabled ? handleSync : () => Alert.alert(
        'Cloud Sync',
        'To enable cloud sync, add your Supabase URL and key in app.json under expo.extra.\n\nThe app works fully offline without it.',
      ),
    },
    {
      icon: 'mic-outline' as const,
      label: 'AI Transcription',
      subtitle: config.openai.enabled
        ? 'Whisper \u2014 Voice notes auto-transcribed'
        : 'Not configured \u2014 add OpenAI key to enable',
      onPress: () => Alert.alert(
        'AI Transcription',
        config.openai.enabled
          ? 'Voice notes are automatically transcribed using OpenAI Whisper after recording.'
          : 'To enable AI transcription, add your OpenAI API key in app.json.\n\nVoice notes still work without it \u2014 you just won\'t get automatic text transcription.',
      ),
    },
    {
      icon: 'sparkles-outline' as const,
      label: 'AI Descriptions',
      subtitle: config.anthropic.enabled
        ? 'Claude \u2014 Generate contract-ready descriptions'
        : 'Not configured \u2014 add Anthropic key to enable',
      onPress: () => Alert.alert(
        'AI Descriptions',
        config.anthropic.enabled
          ? 'Claude generates professional, contract-ready variation descriptions from your voice notes and site data.'
          : 'To enable AI descriptions, add your Anthropic API key in app.json.\n\nYou can always write descriptions manually.',
      ),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Evidence Chain',
      subtitle: `${totalVariations} variations with SHA-256 integrity hashes`,
      onPress: () => Alert.alert(
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
      icon: 'information-circle-outline' as const,
      label: 'About',
      subtitle: `Version ${config.app.version} \u00B7 Pipeline Consulting`,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

      <View style={styles.card}>
        {items.map((item, index) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.row,
              pressed && item.onPress ? styles.rowPressed : null,
              index === 0 ? styles.rowFirst : null,
              index === items.length - 1 ? styles.rowLast : null,
              index < items.length - 1 ? styles.rowBorder : null,
              item.highlight ? styles.rowHighlight : null,
            ]}
            onPress={item.onPress}
            disabled={(resetting && item.label === 'Reset Demo Data') || (syncing && item.label === 'Cloud Sync')}
          >
            <View style={styles.rowIcon}>
              <Ionicons
                name={item.icon}
                size={22}
                color={item.highlight ? (isOffice ? colors.info : colors.accent) : item.destructive ? colors.status.disputed : colors.textSecondary}
              />
            </View>
            <View style={styles.rowContent}>
              <Text
                style={[
                  styles.rowLabel,
                  item.destructive ? { color: colors.status.disputed } : null,
                  item.highlight ? { color: isOffice ? colors.info : colors.accent } : null,
                ]}
              >
                {item.label === 'Reset Demo Data' && resetting ? 'Resetting...'
                  : item.label === 'Cloud Sync' && syncing ? 'Syncing...'
                  : item.label}
              </Text>
              <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
            </View>
            {item.highlight ? (
              <Switch
                value={isOffice}
                onValueChange={handleModeToggle}
                trackColor={{ false: colors.border, true: colors.info }}
                thumbColor={colors.textInverse}
              />
            ) : item.badge ? (
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
        Variation Capture {'\u00B7'} Pipeline Consulting Pty Ltd{'\n'}
        Built for Victorian construction contractors
      </Text>

      <Modal visible={showAuthModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAuthModal(false)}>
          <Pressable style={styles.pinCard} onPress={() => {}}>
            <Text style={styles.pinTitle}>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
            <Text style={styles.pinSubtitle}>
              {authMode === 'signup' ? 'Set up cloud sync for your data' : 'Access your synced data'}
            </Text>
            {authMode === 'signup' && (
              <TextInput
                style={[styles.pinInput, { fontSize: 16, letterSpacing: 0, textAlign: 'left', marginBottom: spacing.sm }]}
                placeholder="Full Name"
                placeholderTextColor={colors.textMuted}
                value={authName}
                onChangeText={setAuthName}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={[styles.pinInput, { fontSize: 16, letterSpacing: 0, textAlign: 'left', marginBottom: spacing.sm }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={authEmail}
              onChangeText={setAuthEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.pinInput, { fontSize: 16, letterSpacing: 0, textAlign: 'left' }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={authPassword}
              onChangeText={setAuthPassword}
              secureTextEntry
            />
            <View style={styles.pinActions}>
              <Pressable style={styles.pinCancel} onPress={() => setShowAuthModal(false)}>
                <Text style={styles.pinCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.pinSubmit} onPress={handleAuth} disabled={authLoading}>
                <Text style={styles.pinSubmitText}>
                  {authLoading ? 'Loading...' : authMode === 'signup' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
              <Text style={[styles.pinHint, { marginTop: spacing.md }]}>
                {authMode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
