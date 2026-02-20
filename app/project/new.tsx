/**
 * New Project Screen
 * Desktop: centered card form. Mobile: full-screen scroll.
 */

import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Alert,
  KeyboardAvoidingView, SafeAreaView, Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createProject } from '../../src/db/projectRepository';
import { ContractType } from '../../src/types/domain';
import { spacing, borderRadius, typography } from '../../src/theme';
import { useThemeColors } from '../../src/contexts/AppModeContext';
import { getCurrentLocation } from '../../src/services/location';

const CONTRACT_TYPES = [
  { value: 'lump_sum', label: 'Lump Sum' },
  { value: 'schedule_of_rates', label: 'Schedule of Rates' },
  { value: 'cost_plus', label: 'Cost Plus' },
  { value: 'design_and_construct', label: 'Design & Construct' },
];

export default function NewProjectScreen() {
  const colors = useThemeColors();
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
    } catch {
      Alert.alert('Error', 'Failed to create project.');
    } finally {
      setSaving(false);
    }
  };

  // ── DESKTOP (web) ────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: 'New Project' }} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingTop: 48, paddingBottom: 48, paddingHorizontal: 24 }}>
          <View style={{
            width: '100%', maxWidth: 560,
            backgroundColor: colors.surface,
            borderRadius: 16, borderWidth: 1, borderColor: colors.border,
            overflow: 'hidden',
          }}>
            {/* Card header */}
            <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>New Project</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                Set up a new project to start capturing variations
              </Text>
            </View>

            {/* Fields */}
            <View style={{ padding: 24, gap: 20 }}>
              {/* Name + Client side by side */}
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={webLabel}>PROJECT NAME *</Text>
                  <TextInput
                    style={[webInput(colors)]}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Northern Hospital — Block D"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={webLabel}>CLIENT *</Text>
                  <TextInput
                    style={webInput(colors)}
                    value={client}
                    onChangeText={setClient}
                    placeholder="e.g. Health Infrastructure"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Reference */}
              <View>
                <Text style={webLabel}>REFERENCE / CONTRACT NO.</Text>
                <TextInput
                  style={webInput(colors)}
                  value={reference}
                  onChangeText={setReference}
                  placeholder="e.g. HI-2025-041"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Contract type */}
              <View>
                <Text style={webLabel}>CONTRACT TYPE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {CONTRACT_TYPES.map((ct) => (
                    <Pressable
                      key={ct.value}
                      onPress={() => setContractType(ct.value as ContractType)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: borderRadius.full,
                        borderWidth: 1,
                        borderColor: contractType === ct.value ? colors.accent : colors.border,
                        backgroundColor: contractType === ct.value ? colors.accentLight : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: contractType === ct.value ? '700' : '500',
                        color: contractType === ct.value ? colors.accent : colors.textSecondary,
                      }}>
                        {ct.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* GPS note */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted }}>GPS coordinates captured automatically</Text>
              </View>
            </View>

            {/* Card footer actions */}
            <View style={{
              flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
              padding: 20, borderTopWidth: 1, borderTopColor: colors.border,
              backgroundColor: `${colors.border}30`,
            }}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  paddingHorizontal: 18, paddingVertical: 9,
                  borderRadius: 8, borderWidth: 1, borderColor: colors.border,
                  backgroundColor: pressed ? colors.border : colors.surface,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 7,
                  paddingHorizontal: 20, paddingVertical: 9,
                  borderRadius: 8, backgroundColor: colors.accent,
                  opacity: pressed || saving ? 0.75 : 1,
                })}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  {saving ? 'Creating…' : 'Create Project'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── MOBILE ────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'New Project' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          {[
            { label: 'PROJECT NAME *', value: name, setter: setName, placeholder: 'e.g. Westgate Tunnel - Section 4B' },
            { label: 'CLIENT *', value: client, setter: setClient, placeholder: 'e.g. CPBJH JV' },
            { label: 'REFERENCE', value: reference, setter: setReference, placeholder: 'e.g. WGT-4B-2025' },
          ].map((field) => (
            <View key={field.label} style={{ marginBottom: spacing.xl }}>
              <Text style={{ ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm }}>{field.label}</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.lg, fontSize: 16, color: colors.text, minHeight: 48 }}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          ))}

          <View style={{ marginBottom: spacing.xl }}>
            <Text style={{ ...typography.overline, color: colors.textMuted, marginBottom: spacing.sm }}>CONTRACT TYPE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {CONTRACT_TYPES.map((ct) => (
                <Pressable
                  key={ct.value}
                  style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.full, borderWidth: 1, borderColor: contractType === ct.value ? colors.accent : colors.border, backgroundColor: contractType === ct.value ? colors.accentLight : colors.surface }}
                  onPress={() => setContractType(ct.value as ContractType)}
                >
                  <Text style={{ fontSize: 13, fontWeight: contractType === ct.value ? '700' : '500', color: contractType === ct.value ? colors.accent : colors.textSecondary }}>{ct.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg }}>
          <Pressable
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: borderRadius.lg, paddingVertical: 14, opacity: pressed || saving ? 0.75 : 1 })}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark" size={24} color="#fff" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{saving ? 'Creating…' : 'Create Project'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const webLabel: any = {
  fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
  textTransform: 'uppercase', color: '#9a9490', marginBottom: 6,
};

const webInput = (colors: any): any => ({
  backgroundColor: colors.bg,
  borderWidth: 1, borderColor: colors.border,
  borderRadius: 8, padding: 10,
  fontSize: 14, color: colors.text,
  outlineStyle: 'none',
});
