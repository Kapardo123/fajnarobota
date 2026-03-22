import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Text, Button, TextInput, Chip, Switch, Card, Avatar, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Config } from '../../constants/Config';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '../../src/lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'candidate' | 'employer'>('candidate');
  const [loading, setLoading] = useState(false);

  // Auth data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Candidate data
  const [candidateData, setCandidateData] = useState({
    name: '',
    age: '',
    skills: [] as string[],
    salary: '',
    superpower: '',
    experience: 'Junior',
    profileMode: 'real' as 'real' | 'avatar' | 'work',
    blindHiring: true, // Domyślnie włączone
    photoUrl: Config.DEFAULT_CANDIDATE_PHOTO,
  });

  // Employer data
  const [employerData, setEmployerData] = useState({
    companyName: '',
    position: '',
    salaryRange: '',
    description: '',
    photoUrl: Config.DEFAULT_EMPLOYER_PHOTO,
  });

  const SKILLS_LIST = ['Gastronomia', 'Barista', 'Sprzedawca', 'Obsługa klienta', 'Magazynier', 'Student', 'Angielski B2', 'Kierowca'];
  const SUPERPOWERS = ['#OgarniamChaos', '#NigdyNieSpóźniony', '#MistrzExcela', '#UśmiechNaTwarzy', '#SzybkiJakBłyskawica'];

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. Rejestracja w Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Nie udało się utworzyć konta.');

      const userId = authData.user.id;

      // 2. Utworzenie profilu w tabeli profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          role,
          full_name: role === 'candidate' ? candidateData.name : employerData.companyName,
          avatar_url: role === 'candidate' ? candidateData.photoUrl : employerData.photoUrl,
        });

      if (profileError) throw profileError;

      // 3. Zapisanie szczegółów roli
      if (role === 'candidate') {
        const { error: candidateError } = await supabase
          .from('candidates')
          .insert({
            id: userId,
            age: parseInt(candidateData.age),
            salary_expectation: candidateData.salary,
            skills: candidateData.skills,
            superpower: candidateData.superpower,
            experience: candidateData.experience,
            blind_hiring: candidateData.blindHiring,
          });
        if (candidateError) throw candidateError;
      } else {
        const { error: employerError } = await supabase
          .from('employers')
          .insert({
            id: userId,
            company_name: employerData.companyName,
            company_description: employerData.description,
            average_salary: employerData.salaryRange,
          });
        if (employerError) throw employerError;
      }

      Alert.alert('Sukces!', 'Twoje konto zostało utworzone.');
      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = error.message || 'Wystąpił nieoczekiwany błąd.';
      
      // Specyficzna obsługa błędu rate limit w Supabase
      if (error.status === 429 || errorMessage.includes('rate_limit')) {
        errorMessage = 'Przekroczono limit wysyłania e-maili w Supabase (Free Tier). Wyłącz "Confirm Email" w ustawieniach Supabase Auth lub spróbuj ponownie za godzinę.';
      } else if (error.status === 422 || errorMessage.includes('already_exists')) {
        errorMessage = 'Użytkownik o tym adresie e-mail już istnieje. Zaloguj się lub usuń starego użytkownika w Supabase Dashboard (Auth -> Users).';
      }

      Alert.alert('Błąd rejestracji', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const maxSteps = role === 'candidate' ? 5 : 4;
    if (step < maxSteps) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const toggleSkill = (skill: string) => {
    if (candidateData.skills.includes(skill)) {
      setCandidateData({
        ...candidateData,
        skills: candidateData.skills.filter(s => s !== skill)
      });
    } else if (candidateData.skills.length < 5) {
      setCandidateData({
        ...candidateData,
        skills: [...candidateData.skills, skill]
      });
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Kim jesteś?</Text>
            <Text style={styles.stepSubtitle}>Twoja rola pomoże nam dopasować najlepsze funkcje.</Text>
            
            <View style={styles.roleGrid}>
              <TouchableOpacity 
                onPress={() => setRole('candidate')}
                style={[
                  styles.roleCard, 
                  role === 'candidate' && styles.roleCardActive
                ]}
              >
                <View style={[styles.roleIconCircle, role === 'candidate' && styles.roleIconCircleActive]}>
                  <MaterialCommunityIcons 
                    name="account-search-outline" 
                    size={40} 
                    color={role === 'candidate' ? '#fff' : Colors.primary} 
                  />
                </View>
                <Text style={[styles.roleLabel, role === 'candidate' && styles.roleLabelActive]}>Szukam pracy</Text>
                <Text style={styles.roleDesc}>Zostań bohaterem i znajdź wymarzone zajęcie.</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setRole('employer')}
                style={[
                  styles.roleCard, 
                  role === 'employer' && styles.roleCardActive
                ]}
              >
                <View style={[styles.roleIconCircle, role === 'employer' && styles.roleIconCircleActive]}>
                  <MaterialCommunityIcons 
                    name="office-building-marker-outline" 
                    size={40} 
                    color={role === 'employer' ? '#fff' : Colors.primary} 
                  />
                </View>
                <Text style={[styles.roleLabel, role === 'employer' && styles.roleLabelActive]}>Szukam pracownika</Text>
                <Text style={styles.roleDesc}>Zrekrutuj najlepszych ludzi w kilka sekund.</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Dane logowania</Text>
            <Text style={styles.stepSubtitle}>Twoje bezpieczne wejście do świata FajnaRobota.</Text>
            <View style={styles.form}>
              <TextInput
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                style={styles.input}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                label="Hasło"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {role === 'candidate' ? 'Opowiedz o sobie' : 'Opowiedz o firmie'}
            </Text>
            <Text style={styles.stepSubtitle}>Podaj podstawowe informacje, aby zacząć.</Text>
            
            {role === 'candidate' ? (
              <View style={styles.form}>
                <TextInput
                  label="Imię i nazwisko"
                  value={candidateData.name}
                  onChangeText={(text) => setCandidateData({...candidateData, name: text})}
                  mode="outlined"
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                />
                <TextInput
                  label="Wiek"
                  value={candidateData.age}
                  onChangeText={(text) => setCandidateData({...candidateData, age: text})}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                />
                <Text style={styles.sectionLabel}>Oczekiwania finansowe</Text>
                <View style={styles.chipContainer}>
                  {Config.SALARY_RANGES.map(range => (
                    <Chip 
                      key={range}
                      selected={candidateData.salary === range}
                      onPress={() => setCandidateData({...candidateData, salary: range})}
                      style={[
                        styles.chip,
                        candidateData.salary === range && { backgroundColor: Colors.primary }
                      ]}
                      showSelectedCheck={false}
                      selectedColor={candidateData.salary === range ? '#fff' : Colors.text}
                    >
                      {range}
                    </Chip>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.form}>
                <TextInput
                  label="Nazwa firmy"
                  value={employerData.companyName}
                  onChangeText={(text) => setEmployerData({...employerData, companyName: text})}
                  mode="outlined"
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                />
                <Text style={styles.sectionLabel}>Oferowane wynagrodzenie (średnie)</Text>
                <View style={styles.chipContainer}>
                  {Config.SALARY_RANGES.map(range => (
                    <Chip 
                      key={range}
                      selected={employerData.salaryRange === range}
                      onPress={() => setEmployerData({...employerData, salaryRange: range})}
                      style={[
                        styles.chip,
                        employerData.salaryRange === range && { backgroundColor: Colors.primary }
                      ]}
                      showSelectedCheck={false}
                      selectedColor={employerData.salaryRange === range ? '#fff' : Colors.text}
                    >
                      {range}
                    </Chip>
                  ))}
                </View>
                <TextInput
                  label="Twój opis / O firmie"
                  value={employerData.description}
                  onChangeText={(text) => setEmployerData({...employerData, description: text})}
                  mode="outlined"
                  multiline
                  numberOfLines={4}
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                />
              </View>
            )}
          </View>
        );

      case 4:
        return role === 'candidate' ? (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Twoje umiejętności</Text>
            <Text style={styles.stepSubtitle}>Wybierz do 5 najważniejszych skilli i swoją supermoc.</Text>

            <View style={styles.chipContainer}>
              {SKILLS_LIST.map(skill => (
                <Chip 
                  key={skill}
                  selected={candidateData.skills.includes(skill)}
                  onPress={() => toggleSkill(skill)}
                  style={[
                    styles.chip,
                    candidateData.skills.includes(skill) && { backgroundColor: Colors.primary }
                  ]}
                  showSelectedCheck={false}
                  selectedColor={candidateData.skills.includes(skill) ? '#fff' : Colors.text}
                >
                  {skill}
                </Chip>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Supermoc</Text>
            <View style={styles.chipContainer}>
              {SUPERPOWERS.map(power => (
                <Chip 
                  key={power}
                  selected={candidateData.superpower === power}
                  onPress={() => setCandidateData({...candidateData, superpower: power})}
                  style={[
                    styles.chip,
                    candidateData.superpower === power && { backgroundColor: Colors.xpBar }
                  ]}
                  showSelectedCheck={false}
                  selectedColor={candidateData.superpower === power ? '#000' : Colors.text}
                >
                  {power}
                </Chip>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Gotowy do rekrutacji?</Text>
            <Text style={styles.stepSubtitle}>To już ostatni krok przed znalezieniem najlepszych pracowników.</Text>
            <View style={styles.summaryCard}>
              <MaterialCommunityIcons name="check-decagram" size={60} color={Colors.primary} />
              <Text style={styles.summaryText}>Wszystko gotowe! Kliknij zakończ, aby utworzyć profil firmy.</Text>
            </View>
          </View>
        );

      case 5:
        return role === 'candidate' ? (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Twoje zdjęcie</Text>
            <Text style={styles.stepSubtitle}>Dodaj zdjęcie profilowe i ustaw widoczność.</Text>

            <View style={styles.photoContainer}>
              <Image 
                source={{ uri: candidateData.photoUrl }} 
                style={styles.photoPreview} 
              />
              <Button 
                mode="outlined" 
                onPress={() => {}} // Tu w przyszłości wybór zdjęcia
                style={styles.uploadBtn}
                textColor={Colors.primary}
                icon="camera"
              >
                Zmień zdjęcie
              </Button>
            </View>

            <View style={styles.privacyCard}>
              <View style={styles.privacyInfo}>
                <Text style={styles.privacyTitle}>Tryb Blind Hiring</Text>
                <Text style={styles.privacySubtitle}>Zdjęcie będzie rozmyte do momentu Matcha</Text>
              </View>
              <Switch 
                value={candidateData.blindHiring} 
                onValueChange={(val) => setCandidateData({...candidateData, blindHiring: val})}
                color={Colors.primary}
              />
            </View>
          </View>
        ) : null;
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${(step / (role === 'candidate' ? 5 : 4)) * 100}%` }]} />
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          mode="contained" 
          onPress={handleNext}
          loading={loading}
          disabled={loading}
          style={styles.nextButton}
          contentStyle={styles.nextButtonContent}
          buttonColor={Colors.primary}
        >
          {step === (role === 'candidate' ? 5 : 4) ? 'Zakończ' : 'Dalej'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  progressContainer: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 32,
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    marginBottom: 40,
    lineHeight: 24,
  },
  roleGrid: {
    gap: 20,
  },
  roleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: Colors.border,
    elevation: 2,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(0, 200, 83, 0.05)',
  },
  roleIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  roleIconCircleActive: {
    backgroundColor: Colors.primary,
  },
  roleLabel: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: Colors.text,
    marginBottom: 8,
  },
  roleLabelActive: {
    color: Colors.primary,
  },
  roleDesc: {
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    lineHeight: 20,
  },
  form: {
    gap: 20,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: Colors.text,
    marginBottom: 16,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
    borderRadius: 20,
    marginTop: 32,
  },
  privacyInfo: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: Colors.text,
  },
  privacySubtitle: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    marginTop: 2,
  },
  photoContainer: {
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
  photoPreview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadBtn: {
    borderRadius: 12,
  },
  summaryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 24,
  },
  summaryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    textAlign: 'center',
    color: Colors.text,
    lineHeight: 28,
  },
  footer: {
    padding: 24,
    backgroundColor: Colors.surface,
  },
  nextButton: {
    borderRadius: 16,
    elevation: 4,
  },
  nextButtonContent: {
    paddingVertical: 12,
  },
});
