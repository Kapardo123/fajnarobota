import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Text, Button, TextInput, Chip, Switch, Card, Avatar, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SvgUri } from 'react-native-svg';
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
    blindHiring: false,
    avatarSeed: Math.random().toString(36).substring(7),
    avatarTraits: {
      top: 'bigHair',
      eyes: 'default',
      mouth: 'smile',
      clothing: 'graphicShirt',
      clothesColor: '65c9ff',
      skinColor: 'ffdbb4',
      hairColor: '2c1b18',
    },
  });

  // Employer data
  const [employerData, setEmployerData] = useState({
    companyName: '',
    position: '',
    salaryRange: '',
    description: '',
  });

  const AVATAR_OPTIONS = {
    top: [
      'bigHair', 'bob', 'bun', 'curly', 'curvy', 'dreads', 'shaggy', 'shortCurly', 
      'shortFlat', 'shortRound', 'shortWaved', 'straight01', 'straight02', 
      'theCaesar', 'turban', 'winterHat1', 'miaWallace', 'shavedSides'
    ],
    eyes: [
      'default', 'happy', 'surprised', 'wink', 'side', 'squint', 'hearts', 
      'eyeRoll', 'winkWacky', 'xDizzy', 'closed', 'cry'
    ],
    mouth: [
      'smile', 'default', 'serious', 'tongue', 'twinkle', 'grimace', 'concerned', 
      'disbelief', 'eating', 'sad', 'screamOpen', 'vomit'
    ],
    clothing: [
      'graphicShirt', 'blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 
      'hoodie', 'overall', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck'
    ],
    clothesColor: [
      '262e33', '65c9ff', '5199e4', '25557c', 'e6e6e6', '929598', '3c4f5c', 
      'b1e2ff', 'a7ffc4', 'ffdeb5', 'ffafb9', 'ffffb1', 'ff488e', 'ff5c5c', 'ffffff'
    ],
    skinColor: [
      '614335', 'd08b5b', 'ae5d29', 'edb98a', 'ffdbb4', 'fd9841', 'f8d25c'
    ],
    hairColor: [
      'a55728', '2c1b18', 'b58143', 'd6b370', '724133', '4a312c', 'f59797', 'ecdcbf', 'c93305', 'e8e1e1'
    ],
  };

  const getAvatarUrl = (seed: string, traits: typeof candidateData.avatarTraits) => {
    const { top, eyes, mouth, clothing, clothesColor, skinColor, hairColor } = traits;
    // Wersja 9.x DiceBear wymaga precyzyjnych wartości. backgroundType=solid i backgroundColor jako lista hexów bez hasha.
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&top=${top}&eyes=${eyes}&mouth=${mouth}&clothing=${clothing}&clothesColor=${clothesColor}&skinColor=${skinColor}&hairColor=${hairColor}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  };

  const updateTrait = (category: keyof typeof AVATAR_OPTIONS, value: string) => {
    setCandidateData({
      ...candidateData,
      avatarTraits: {
        ...candidateData.avatarTraits,
        [category]: value
      }
    });
  };

  const rollAvatar = () => {
    const randomTrait = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    setCandidateData({
      ...candidateData,
      avatarSeed: Math.random().toString(36).substring(7),
      avatarTraits: {
        top: randomTrait(AVATAR_OPTIONS.top),
        eyes: randomTrait(AVATAR_OPTIONS.eyes),
        mouth: randomTrait(AVATAR_OPTIONS.mouth),
        clothing: randomTrait(AVATAR_OPTIONS.clothing),
        clothesColor: randomTrait(AVATAR_OPTIONS.clothesColor),
        skinColor: randomTrait(AVATAR_OPTIONS.skinColor),
        hairColor: randomTrait(AVATAR_OPTIONS.hairColor),
      }
    });
  };

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
          avatar_url: role === 'candidate' ? getAvatarUrl(candidateData.avatarSeed, candidateData.avatarTraits) : 'https://picsum.photos/seed/company/200',
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
            avatar_traits: candidateData.avatarTraits,
          });
        if (candidateError) throw candidateError;
      } else {
        const { error: employerError } = await supabase
          .from('employers')
          .insert({
            id: userId,
            company_name: employerData.companyName,
            company_description: employerData.description,
          });
        if (employerError) throw employerError;
      }

      Alert.alert('Sukces!', 'Twoje konto zostało utworzone.');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Błąd', error.message || 'Wystąpił nieoczekiwany błąd.');
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
                <TextInput
                  label="Oczekiwania finansowe (min. PLN/h)"
                  value={candidateData.salary}
                  onChangeText={(text) => setCandidateData({...candidateData, salary: text})}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.input}
                  outlineColor={Colors.border}
                  activeOutlineColor={Colors.primary}
                />
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
            <Text style={styles.stepTitle}>Twój Bohater</Text>
            <Text style={styles.stepSubtitle}>Dostosuj swój awatar i ustaw widoczność.</Text>

            <View style={styles.privacyCard}>
              <View style={styles.privacyInfo}>
                <Text style={styles.privacyTitle}>Tryb Blind Hiring</Text>
                <Text style={styles.privacySubtitle}>Rozmyj zdjęcie do momentu Matcha</Text>
              </View>
              <Switch 
                value={candidateData.blindHiring} 
                onValueChange={(val) => setCandidateData({...candidateData, blindHiring: val})}
                color={Colors.primary}
              />
            </View>

            <View style={styles.avatarGeneratorContainer}>
              <View style={styles.avatarPreviewFrame}>
                <SvgUri
                  width="120"
                  height="120"
                  uri={getAvatarUrl(candidateData.avatarSeed, candidateData.avatarTraits)}
                />
              </View>
              
              <View style={styles.traitSelectors}>
                {[
                  { key: 'top', label: 'Włosy', icon: 'face-man' },
                  { key: 'clothesColor', label: 'Ubranie', icon: 'palette' },
                  { key: 'hairColor', label: 'Kolor', icon: 'palette-swatch' },
                ].map((trait) => (
                  <View key={trait.key} style={styles.traitRow}>
                    <Text style={styles.traitLabel}>{trait.label}</Text>
                    <View style={styles.traitActionCol}>
                      <IconButton icon="chevron-left" size={20} onPress={() => {
                        const options = AVATAR_OPTIONS[trait.key as keyof typeof AVATAR_OPTIONS];
                        const currentIdx = options.indexOf(candidateData.avatarTraits[trait.key as keyof typeof candidateData.avatarTraits]);
                        updateTrait(trait.key as any, options[(currentIdx - 1 + options.length) % options.length]);
                      }} />
                      <IconButton icon="chevron-right" size={20} onPress={() => {
                        const options = AVATAR_OPTIONS[trait.key as keyof typeof AVATAR_OPTIONS];
                        const currentIdx = options.indexOf(candidateData.avatarTraits[trait.key as keyof typeof candidateData.avatarTraits]);
                        updateTrait(trait.key as any, options[(currentIdx + 1) % options.length]);
                      }} />
                    </View>
                  </View>
                ))}
              </View>
              <Button mode="text" onPress={rollAvatar} icon="refresh" textColor={Colors.primary}>Losuj</Button>
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
  avatarGeneratorContainer: {
    marginTop: 24,
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarPreviewFrame: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 60,
    elevation: 4,
    marginBottom: 20,
  },
  traitSelectors: {
    width: '100%',
    gap: 8,
  },
  traitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingLeft: 16,
    borderRadius: 12,
    height: 44,
  },
  traitLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
  traitActionCol: {
    flexDirection: 'row',
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
