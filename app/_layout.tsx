/**
 * Root Layout
 *
 * Initialises the database, loads fonts, and sets up
 * the navigation stack for the entire app.
 */

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { getDatabase } from '../src/db/schema';
import { seedDatabase } from '../src/db/seedData';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
        await seedDatabase();
        console.log('[App] Database initialised');
      } catch (error) {
        console.error('[App] Initialisation failed:', error);
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

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: {
            fontWeight: '800',
            fontSize: 18,
            color: colors.text,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
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
          options={{ title: 'Variations' }}
        />
        <Stack.Screen
          name="variation/[id]"
          options={{ title: 'Variation Detail' }}
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
    </>
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
