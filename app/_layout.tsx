import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme, configureFonts, FAB, Portal } from 'react-native-paper';
import { useState } from 'react';
import DebugPanel from '../components/DebugPanel';
import { StyleSheet, View } from 'react-native';

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
  showDebugPanel = () => setDebugVisible(true);

  const [loaded, error] = useFonts({
    Montserrat_400Regular,
    Montserrat_700Bold,
    Montserrat_900Black,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
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
