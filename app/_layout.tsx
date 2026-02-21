/**
 * Root Layout
 *
 * Initialises the database, loads seed data, sets up navigation.
 */

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '../src/db/schema';
import { seedDatabase } from '../src/db/seedData';
import { colors } from '../src/theme';
import { AppModeProvider } from '../src/contexts/AppModeContext';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
        await seedDatabase();
        console.log('[App] Database initialised');
      } catch (error) {
        console.error('[App] Init failed:', error);
      } finally {
        setIsReady(true);
      }
    }
    init();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const router = useRouter();

  function HomeButton() {
    return (
      <Pressable
        onPress={() => router.replace('/')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="home-outline" size={20} color={colors.accent} />
      </Pressable>
    );
  }

  return (
    <AppModeProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: {
            fontWeight: '900',
            fontSize: 28,
            color: colors.text,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Back',
          headerRight: () => <HomeButton />,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="project/new"
          options={{
            title: 'New Project',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="project/[id]"
          options={{
            title: 'Variations',
            headerBackTitle: 'Projects',
          }}
        />
        <Stack.Screen
          name="variation/[id]"
          options={{
            title: 'Variation',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="capture/[projectId]"
          options={{
            title: 'New Variation',
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
      </Stack>
    </AppModeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
});
