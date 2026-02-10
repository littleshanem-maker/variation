/**
 * New Project Screen
 *
 * Simple form to create a project.
 * Fields: name, client, reference, contract type.
 * GPS captured automatically for site location.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createProject } from '../../src/db/projectRepository';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';

const CONTRACT_TYPES = [
  { value: 'lump_sum', label: 'Lump Sum' },
  { value: 'schedule_of_rates', label: 'Schedule of Rates' },
  { value: 'cost_plus', label: 'Cost Plus' },
  { value: 'design_construct', label: 'Design & Construct' },
] as const;

export default function NewProjectScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [reference, setReference] = useState('');
  const [contractType, setContractType] = useState<string>('lump_sum');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && client.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    try {
      const project = await createProject({
        name: name.trim(),
        client: client.trim(),
        reference: reference.trim() || `PRJ-${Date.now().toString(36).toUpperCase()}`,
        contractType: contractType as any,
      });

      router.replace(`/project/${project.id}`);
    } catch (error) {
      console.error('[NewProject] Save failed:', error);
      Alert.alert('Error', 'Failed to create project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'New Project',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ paddingRight: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>PROJECT NAME *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Westgate Tunnel – Section 4B"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={styles.fieldLabel}>CLIENT / HEAD CONTRACTOR *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lendlease, CPBJH JV"
            placeholderTextColor={colors.textMuted}
            value={client}
            onChangeText={setClient}
          />

          <Text style={styles.fieldLabel}>PROJECT REFERENCE</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. WT-2026-4B (auto-generated if blank)"
            placeholderTextColor={colors.textMuted}
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
          />

          <Text style={styles.fieldLabel}>CONTRACT TYPE</Text>
          <View style={styles.typeGrid}>
            {CONTRACT_TYPES.map((ct) => (
              <Pressable
                key={ct.value}
                style={[
                  styles.typeOption,
                  contractType === ct.value && styles.typeOptionActive,
                ]}
                onPress={() => setContractType(ct.value)}
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    contractType === ct.value && styles.typeOptionTextActive,
                  ]}
                >
                  {ct.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.bottomAction}>
          <Pressable
            style={[
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
              saving && { opacity: 0.7 },
            ]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            <Ionicons
              name="checkmark"
              size={22}
              color={canSave ? colors.textInverse : colors.textMuted}
            />
            <Text
              style={[
                styles.saveButtonText,
                !canSave && styles.saveButtonTextDisabled,
              ]}
            >
              {saving ? 'Creating...' : 'Create Project'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  fieldLabel: {
    ...typography.overline,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: touchTargets.minimum,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  typeOptionText: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  typeOptionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  bottomAction: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    minHeight: touchTargets.button,
  },
  saveButtonDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButtonText: {
    ...typography.labelLarge,
    color: colors.textInverse,
  },
  saveButtonTextDisabled: {
    color: colors.textMuted,
  },
});
