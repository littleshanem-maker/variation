/**
 * New Project Screen
 */

import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createProject } from '../../src/db/projectRepository';
import { ContractType } from '../../src/types/domain';
import { colors, spacing, borderRadius, typography, touchTargets } from '../../src/theme';
import { getCurrentLocation } from '../../src/services/location';

const CONTRACT_TYPES = [
  { value: 'lump_sum', label: 'Lump Sum' },
  { value: 'schedule_of_rates', label: 'Schedule of Rates' },
  { value: 'cost_plus', label: 'Cost Plus' },
  { value: 'design_and_construct', label: 'Design & Construct' },
];

export default function NewProjectScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [reference, setReference] = useState('');
  const [contractType, setContractType] = useState<ContractType>(ContractType.LUMP_SUM);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !client.trim()) {
      Alert.alert('Required', 'Project name and client are required.');
      return;
    }

    setSaving(true);
    try {
      const location = await getCurrentLocation();
      await createProject({
        name: name.trim(),
        client: client.trim(),
        reference: reference.trim(),
        contractType,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to create project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.label}>PROJECT NAME *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Westgate Tunnel - Section 4B"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CLIENT *</Text>
          <TextInput
            style={styles.input}
            value={client}
            onChangeText={setClient}
            placeholder="e.g. CPBJH JV"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>REFERENCE</Text>
          <TextInput
            style={styles.input}
            value={reference}
            onChangeText={setReference}
            placeholder="e.g. WGT-4B-2025"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CONTRACT TYPE</Text>
          <View style={styles.chipRow}>
            {CONTRACT_TYPES.map((ct) => (
              <Pressable
                key={ct.value}
                style={[
                  styles.chip,
                  contractType === ct.value && styles.chipActive,
                ]}
                onPress={() => setContractType(ct.value as ContractType)}
              >
                <Text
                  style={[
                    styles.chipText,
                    contractType === ct.value && styles.chipTextActive,
                  ]}
                >
                  {ct.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.locationNote}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.locationNoteText}>
            GPS coordinates will be captured automatically
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomAction}>
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={24} color={colors.textInverse} />
          <Text style={styles.saveButtonText}>
            {saving ? 'Creating...' : 'Create Project'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 120 },
  field: { marginBottom: spacing.xl },
  label: { ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.lg, fontSize: 16, color: colors.text, minHeight: touchTargets.button },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  chipText: { ...typography.labelSmall, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: '700' },
  locationNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  locationNoteText: { ...typography.caption, color: colors.textMuted },
  bottomAction: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 14, minHeight: touchTargets.button },
  saveButtonPressed: { backgroundColor: colors.accentHover },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.labelLarge, color: colors.textInverse },
});
