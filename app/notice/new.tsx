/**
 * New Variation Notice
 *
 * Fast single-screen form for field capture of a variation notice.
 * Goal: log a VN in 60 seconds before work starts.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  Alert, SafeAreaView, KeyboardAvoidingView, Platform, Switch, Modal, FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import { createNotice } from '../../src/db/noticeRepository';
import { getCurrentUser } from '../../src/services/auth';
import { getActiveProjects } from '../../src/db/projectRepository';
import { ProjectSummary } from '../../src/types/domain';
import { nowISO } from '../../src/utils/helpers';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewNoticeScreen() {
  const colors = useThemeColors();
  const { projectId: urlProjectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState(todayISO());
  const [costFlag, setCostFlag] = useState(true);
  const [timeFlag, setTimeFlag] = useState(false);
  const [estimatedDays, setEstimatedDays] = useState('');
  const [contractClause, setContractClause] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill issued_by from auth silently
  const [issuedByName, setIssuedByName] = useState<string | undefined>();
  const [issuedByEmail, setIssuedByEmail] = useState<string | undefined>();

  useEffect(() => {
    getCurrentUser().catch(() => null).then((user) => {
      if (user) {
        setIssuedByName(user.fullName || user.email || undefined);
        setIssuedByEmail(user.email || undefined);
      }
    });
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await getActiveProjects();
      setProjects(data);
      // Auto-select first project if none pre-selected
      if (!urlProjectId && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoadingProjects(false);
    }
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleSave = async (issueNow: boolean) => {
    if (!eventDescription.trim()) {
      Alert.alert('Required', 'Please describe what happened on site.');
      return;
    }
    if (!selectedProjectId) {
      Alert.alert('Required', 'Please select a project before saving.');
      return;
    }
    setSaving(true);
    try {
      await createNotice({
        projectId: selectedProjectId,
        eventDescription: eventDescription.trim(),
        eventDate,
        costFlag,
        timeFlag,
        estimatedDays: estimatedDays.trim() ? parseInt(estimatedDays.trim(), 10) : undefined,
        contractClause: contractClause.trim() || undefined,
        issuedByName,
        issuedByEmail,
        status: issueNow ? 'issued' : 'draft',
        issuedAt: issueNow ? nowISO() : undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save notice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: { ...typography.headingSmall, color: colors.text },
    backBtn: { padding: 4 },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: borderRadius.md,
      backgroundColor: colors.accent,
    },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    content: { flex: 1 },
    scroll: { padding: spacing.lg, paddingBottom: 120 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
    field: { marginBottom: spacing.lg },
    fieldLabel: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
    input: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15, color: colors.text,
      minHeight: 48,
    },
    inputMultiline: { minHeight: 96, textAlignVertical: 'top' as const },
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: borderRadius.md, paddingHorizontal: spacing.md,
      paddingVertical: 12, marginBottom: spacing.sm,
    },
    toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    bottomBar: {
      position: 'absolute' as const, bottom: 0, left: 0, right: 0,
      padding: spacing.lg, paddingBottom: 32,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.bg,
      flexDirection: 'row', gap: spacing.md,
    },
    draftBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, borderWidth: 1.5, borderColor: colors.accent,
      borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button,
    },
    draftBtnText: { fontSize: 15, fontWeight: '700', color: colors.accent },
    issueBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, backgroundColor: colors.accent,
      borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button,
    },
    issueBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    disabledBtn: { opacity: 0.5 },
    // Project picker
    projectPickerTrigger: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
      minHeight: 48,
    },
    projectPickerText: { fontSize: 15, color: colors.text },
    projectPickerPlaceholder: { fontSize: 15, color: colors.textMuted },
    pickerChevron: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      maxHeight: '70%',
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
      alignSelf: 'center', marginTop: 12, marginBottom: 4,
    },
    modalTitle: {
      ...typography.headingSmall, color: colors.text, textAlign: 'center',
      paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    projectItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.lg, paddingVertical: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    projectItemName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
    projectItemClient: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    projectItemSelected: { color: colors.accent },
  });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Notice</Text>
        {/* placeholder to center title */}
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>

          {/* Project picker */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PROJECT *</Text>
            <Pressable
              style={styles.projectPickerTrigger}
              onPress={() => {
                if (loadingProjects) return;
                setShowProjectPicker(true);
              }}
            >
              {selectedProject ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.projectPickerText}>{selectedProject.name}</Text>
                  <Text style={styles.projectItemClient}>{selectedProject.client}</Text>
                </View>
              ) : (
                <Text style={styles.projectPickerPlaceholder}>
                  {loadingProjects ? 'Loading projects…' : 'Select a project'}
                </Text>
              )}
              <View style={styles.pickerChevron}>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>

          {/* What happened */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>WHAT HAPPENED *</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={eventDescription}
              onChangeText={setEventDescription}
              placeholder="Describe the event on site…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              autoFocus
            />
          </View>

          {/* Event date */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>EVENT DATE</Text>
            <TextInput
              style={styles.input}
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* Implications */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>IMPLICATIONS</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Cost Impact</Text>
              <Switch
                value={costFlag}
                onValueChange={setCostFlag}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Time Impact</Text>
              <Switch
                value={timeFlag}
                onValueChange={setTimeFlag}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Estimated days — only shown if timeFlag */}
          {timeFlag && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ESTIMATED DAYS</Text>
              <TextInput
                style={styles.input}
                value={estimatedDays}
                onChangeText={setEstimatedDays}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Contract clause */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CONTRACT CLAUSE (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={contractClause}
              onChangeText={setContractClause}
              placeholder="e.g. Clause 36.1 AS 4000"
              placeholderTextColor={colors.textMuted}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [styles.draftBtn, (pressed || saving) && styles.disabledBtn]}
          onPress={() => handleSave(false)}
          disabled={saving}
        >
          <Ionicons name="save-outline" size={18} color={colors.accent} />
          <Text style={styles.draftBtnText}>{saving ? 'Saving…' : 'Save as Draft'}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.issueBtn, (pressed || saving) && styles.disabledBtn]}
          onPress={() => handleSave(true)}
          disabled={saving}
        >
          <Ionicons name="send" size={18} color="#fff" />
          <Text style={styles.issueBtnText}>{saving ? 'Saving…' : 'Issue Now'}</Text>
        </Pressable>
      </View>

      {/* Project picker modal */}
      <Modal
        visible={showProjectPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowProjectPicker(false)}>
          <Pressable onPress={e => e.stopPropagation()} style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Project</Text>
            <FlatList
              data={projects}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.projectItem}
                  onPress={() => {
                    setSelectedProjectId(item.id);
                    setShowProjectPicker(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.projectItemName,
                      item.id === selectedProjectId && styles.projectItemSelected,
                    ]}>{item.name}</Text>
                    <Text style={styles.projectItemClient}>{item.client}</Text>
                  </View>
                  {item.id === selectedProjectId && (
                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted }}>No projects found</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
