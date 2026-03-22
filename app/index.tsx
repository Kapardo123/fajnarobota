import { View, StyleSheet, ImageBackground, Dimensions, ActivityIndicator } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../src/lib/supabase';

const { width, height } = Dimensions.get('window');

export default function LandingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sprawdzamy sesję TYLKO raz przy wejściu na stronę startową
    const checkSession = async () => {
      // getUser() jest pewniejsze niż getSession(), bo weryfikuje token
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/(tabs)');
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop' }} 
        style={styles.heroImage}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.9)', Colors.surface]}
          locations={[0, 0.4, 0.7]}
          style={styles.gradient}
        >
          <SafeAreaView style={styles.safeContent}>
            <View style={styles.topSection}>
              <View style={styles.logoBadge}>
                <MaterialCommunityIcons name="briefcase-variant" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.logoText}>Fajna<Text style={{color: Colors.primary}}>Robota</Text></Text>
            </View>

            <View style={styles.centerSection}>
              <Text style={styles.heroTitle}>Znajdź pracę, którą polubisz.</Text>
              <Text style={styles.heroSubtitle}>Najszybsza droga do fajnej roboty w Twojej okolicy. Swipe'uj, match'uj i zarabiaj!</Text>
              
              <View style={styles.featureRow}>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="currency-usd" size={20} color={Colors.primary} />
                  <Text style={styles.featureText}>Jasne stawki</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="map-marker-radius" size={20} color={Colors.primary} />
                  <Text style={styles.featureText}>Blisko Ciebie</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color={Colors.primary} />
                  <Text style={styles.featureText}>Szybki start</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.buttonContainer}>
              <Button 
                mode="contained" 
                onPress={() => router.push('/(auth)/register')}
                style={styles.mainButton}
                contentStyle={styles.mainButtonContent}
                buttonColor={Colors.primary}
              >
                Zacznij teraz
              </Button>
              <Button 
                mode="text" 
                onPress={() => router.push('/(auth)/login')}
                style={styles.secondaryButton}
                textColor={Colors.text}
              >
                Mam już konto. <Text style={{color: Colors.primary, fontWeight: 'bold'}}>Zaloguj się</Text>
              </Button>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: width,
    height: height,
  },
  gradient: {
    flex: 1,
  },
  safeContent: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  logoBadge: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  logoText: {
    fontSize: 24,
    fontFamily: 'Montserrat_900Black',
    color: '#000',
    letterSpacing: -0.5,
  },
  centerSection: {
    marginTop: 100,
  },
  heroTitle: {
    fontSize: 48,
    fontFamily: 'Montserrat_900Black',
    color: '#000',
    lineHeight: 52,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(0,0,0,0.7)',
    lineHeight: 26,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    gap: 6,
  },
  featureText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
  },
  buttonContainer: {
    gap: 10,
  },
  mainButton: {
    borderRadius: 16,
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  mainButtonContent: {
    paddingVertical: 12,
  },
  secondaryButton: {
    marginTop: 10,
  },
});
