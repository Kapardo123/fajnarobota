import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme, configureFonts, FAB, Portal } from 'react-native-paper';
import { useState } from 'react';
import DebugPanel from '../components/DebugPanel';
import { StyleSheet, View } from 'react-native';
import { supabase } from '../src/lib/supabase';

// Eksportujemy funkcję do otwierania panelu globalnie (uproszczenie dla prototypu)
export let showDebugPanel: () => void = () => {};
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Montserrat_400Regular, Montserrat_700Bold, Montserrat_900Black } from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

const fontConfig = {
  fontFamily: 'Montserrat_400Regular',
};

const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
};

export default function RootLayout() {
  const [debugVisible, setDebugVisible] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  showDebugPanel = () => setDebugVisible(true);

  const [loaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_700Bold,
    Montserrat_900Black,
  });

  // Globalny listener stanu autoryzacji
  useEffect(() => {
    if (!loaded) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth Event:', event, session ? 'User logged in' : 'User logged out');
      
      const inAuthGroup = segments[0] === '(auth)';
      const inTabsGroup = segments[0] === '(tabs)';

      if (!session && inTabsGroup) {
        // Użytkownik wylogowany, a jest w zakładkach -> rzuć go na start
        router.replace('/');
      } else if (session && (inAuthGroup || segments.length === 0 || segments[0] === 'index')) {
        // Użytkownik zalogowany, a jest na logowaniu/rejestracji/startowej -> rzuć go do aplikacji
        router.replace('/(tabs)');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loaded, segments]);

  useEffect(() => {
    if (loaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [loaded, fontError]);

  if (!loaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        
        <Portal>
          <FAB
            icon="bug"
            style={styles.fab}
            onPress={() => setDebugVisible(true)}
            size="small"
            color="white"
          />
        </Portal>

        <DebugPanel visible={debugVisible} onHide={() => setDebugVisible(false)} />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 80, // Powyżej paska tabów jeśli jest widoczny
    backgroundColor: 'rgba(255, 0, 0, 0.5)', // Półprzezroczysty czerwony, żeby nie przeszkadzał ale był widoczny
    borderRadius: 28,
  },
});
