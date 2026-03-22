import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Błąd', 'Proszę podać e-mail i hasło.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Błąd logowania', error.message || 'Nieprawidłowe dane logowania.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.title}>Witaj ponownie!</Text>
            <Text style={styles.subtitle}>Zaloguj się, aby kontynuować szukanie fajnej roboty.</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              left={<TextInput.Icon icon="email-outline" color={Colors.textLight} />}
            />
            <TextInput
              label="Hasło"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={secureText}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              left={<TextInput.Icon icon="lock-outline" color={Colors.textLight} />}
              right={
                <TextInput.Icon 
                  icon={secureText ? "eye-outline" : "eye-off-outline"} 
                  onPress={() => setSecureText(!secureText)}
                  color={Colors.textLight}
                />
              }
            />
            
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Zapomniałeś hasła?</Text>
            </TouchableOpacity>

            <Button 
              mode="contained" 
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
              contentStyle={styles.buttonContent}
              buttonColor={Colors.primary}
            >
              Zaloguj się
            </Button>
          </View>

          <View style={styles.dividerSection}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>lub zaloguj przez</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialButtons}>
            <IconButton
              icon="google"
              mode="outlined"
              size={30}
              onPress={() => {}}
              style={styles.socialIcon}
              iconColor="#DB4437"
            />
            <IconButton
              icon="apple"
              mode="outlined"
              size={30}
              onPress={() => {}}
              style={styles.socialIcon}
              iconColor="#000"
            />
            <IconButton
              icon="facebook"
              mode="outlined"
              size={30}
              onPress={() => {}}
              style={styles.socialIcon}
              iconColor="#4267B2"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Nie masz jeszcze konta?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.signUpText}>Zarejestruj się</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  backButton: {
    marginBottom: 32,
  },
  headerSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: Colors.primary,
    fontFamily: 'Montserrat_700Bold',
  },
  loginButton: {
    marginTop: 8,
    borderRadius: 16,
    elevation: 4,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  dividerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 40,
    gap: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textLight,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  socialIcon: {
    borderColor: Colors.border,
    borderRadius: 16,
    width: 60,
    height: 60,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 'auto',
    gap: 6,
    paddingBottom: 20,
  },
  footerText: {
    color: Colors.textLight,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 15,
  },
  signUpText: {
    color: Colors.primary,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
  },
});
