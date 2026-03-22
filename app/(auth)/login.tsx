import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { Text, Button, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../../src/lib/supabase';
import { logger } from '../../src/lib/logger';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{email?: string, password?: string}>({});

  const validate = () => {
    const newErrors: {email?: string, password?: string} = {};
    
    if (!email) {
      newErrors.email = 'E-mail jest wymagany';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Niepoprawny format e-mail';
    }

    if (!password) {
      newErrors.password = 'Hasło jest wymagane';
    } else if (password.length < 6) {
      newErrors.password = 'Hasło musi mieć min. 6 znaków';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      logger.info('Próba logowania', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error('Błąd logowania Supabase', error);
        if (error.message.includes('Invalid login credentials')) {
          setErrors({ email: 'Błędny e-mail lub hasło' });
        }
        throw error;
      }
      
      logger.info('Zalogowano pomyślnie', { userId: data.user?.id });
      router.replace('/(tabs)');
    } catch (error: any) {
      if (!error.message.includes('Invalid login credentials')) {
        Alert.alert('Błąd logowania', error.message);
      }
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
            <View>
              <TextInput
                label="E-mail"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({...errors, email: undefined});
                }}
                mode="outlined"
                error={!!errors.email}
                style={styles.input}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                left={<TextInput.Icon icon="email-outline" color={errors.email ? Colors.error : Colors.textLight} />}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View>
              <TextInput
                label="Hasło"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({...errors, password: undefined});
                }}
                mode="outlined"
                error={!!errors.password}
                secureTextEntry={secureText}
                style={styles.input}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                left={<TextInput.Icon icon="lock-outline" color={errors.password ? Colors.error : Colors.textLight} />}
                right={
                  <TextInput.Icon 
                    icon={secureText ? "eye-outline" : "eye-off-outline"} 
                    onPress={() => setSecureText(!secureText)}
                    color={Colors.textLight}
                  />
                }
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>
            
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
  errorText: {
    color: Colors.error,
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    marginTop: 4,
    marginLeft: 4,
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
