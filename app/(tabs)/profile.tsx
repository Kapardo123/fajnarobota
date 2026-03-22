import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { Avatar, Text, Button, List, Divider, ProgressBar, Chip, IconButton, TextInput, Card, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Config } from '../../constants/Config';
import { useState, useEffect } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, uploadAvatar } from '../../src/lib/supabase';
import { logger } from '../../src/lib/logger';

interface JobOffer {
  id: string;
  title: string;
  salary: string;
  location: string;
  matches: number;
}

interface UserProfile {
  id: string;
  role: 'candidate' | 'employer';
  full_name: string;
  avatar_url: string;
  location_name?: string;
  lat?: number;
  lng?: number;
}

interface CandidateDetails {
  age: number;
  salary_expectation: string;
  skills: string[];
  superpower: string;
  blind_hiring: boolean;
}

interface EmployerDetails {
  company_name: string;
  company_description: string;
  average_salary?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<CandidateDetails | null>(null);
  const [employerDetails, setEmployerDetails] = useState<EmployerDetails | null>(null);
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJob, setNewJob] = useState({ title: '', salary: '', locationName: '' });
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationLocationInput] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    logger.action('Wyloguj (Próba)');
    
    try {
      // 1. Supabase SignOut (nie czekamy na wynik, żeby nie blokować)
      supabase.auth.signOut().catch(e => console.error('SignOut error:', e));
      
      // 2. Czyścimy stan lokalny
      setProfile(null);
      setCandidateDetails(null);
      setEmployerDetails(null);
      
      // 3. Wymuszamy nawigację do root
      // Używamy setTimeout, aby upewnić się, że żadne inne procesy nie blokują routera
      setTimeout(() => {
        router.replace('/');
      }, 0);
      
    } catch (error: any) {
      console.error('Logout error:', error);
      router.replace('/');
    }
  };

  const pickAndUploadImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && profile) {
        setUploading(true);
        const publicUrl = await uploadAvatar(result.assets[0].uri, profile.id);
        
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', profile.id);

        if (error) throw error;

        setProfile({ ...profile, avatar_url: publicUrl });
        Alert.alert('Sukces', 'Zdjęcie profilowe zostało zaktualizowane.');
      }
    } catch (error: any) {
      Alert.alert('Błąd', 'Nie udało się zaktualizować zdjęcia.');
    } finally {
      setUploading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Pobierz profil podstawowy
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // 2. Pobierz szczegóły roli
      if (profileData.role === 'candidate') {
        const { data: candData, error: candError } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', user.id)
          .single();
        if (candError) throw candError;
        setCandidateDetails(candData);
      } else {
        const { data: empData, error: empError } = await supabase
          .from('employers')
          .select('*')
          .eq('id', user.id)
          .single();
        if (empError) throw empError;
        setEmployerDetails(empData);

        // Pobierz oferty pracy
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .eq('employer_id', user.id);
        if (jobsError) throw jobsError;
        setJobs(jobsData.map((j: any) => ({
          id: j.id,
          title: j.title,
          salary: j.salary_range,
          location: j.location_name,
          matches: 0
        })));
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddJob = async () => {
    if (newJob.title && newJob.salary && newJob.locationName) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Symulacja geokodowania dla nowej oferty
        const mockLat = 52.2297 + (Math.random() - 0.5) * 0.5;
        const mockLng = 21.0122 + (Math.random() - 0.5) * 0.5;

        const { data, error } = await supabase
          .from('jobs')
          .insert({
            employer_id: user.id,
            title: newJob.title,
            salary_range: newJob.salary,
            location_name: newJob.locationName,
            lat: mockLat,
            lng: mockLng,
          })
          .select()
          .single();

        if (error) throw error;

        setJobs([...jobs, {
          id: data.id,
          title: data.title,
          salary: data.salary_range,
          location: data.location_name,
          matches: 0
        }]);
        setNewJob({ title: '', salary: '', locationName: '' });
        setShowAddJob(false);
      } catch (error: any) {
        Alert.alert('Błąd', 'Nie udało się dodać oferty.');
      }
    }
  };

  const updateSalary = async (newSalary: string) => {
    logger.action('Wybór wynagrodzenia', { salary: newSalary });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (profile?.role === 'candidate') {
        const { error } = await supabase
          .from('candidates')
          .update({ salary_expectation: newSalary })
          .eq('id', user.id);
        if (error) throw error;
        setCandidateDetails(prev => ({ ...prev!, salary_expectation: newSalary }));
      } else {
        const { error } = await supabase
          .from('employers')
          .update({ average_salary: newSalary })
          .eq('id', user.id);
        if (error) throw error;
        setEmployerDetails(prev => ({ ...prev!, average_salary: newSalary }));
      }
      setIsEditingSalary(false);
      Alert.alert('Sukces', 'Wynagrodzenie zostało zaktualizowane.');
    } catch (error: any) {
      console.error('Update salary error:', error);
      Alert.alert('Błąd', 'Nie udało się zaktualizować wynagrodzenia.');
    }
  };

  const updateLocation = async () => {
      logger.action('Zapis lokalizacji', { location: locationInput });
      if (!locationInput.trim()) {
        Alert.alert('Błąd', 'Wprowadź nazwę miejscowości.');
      return;
    }
    
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Symulacja geokodowania
      const mockLat = 52.2297 + (Math.random() - 0.5) * 0.5;
      const mockLng = 21.0122 + (Math.random() - 0.5) * 0.5;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          location_name: locationInput,
          lat: mockLat,
          lng: mockLng
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev!, location_name: locationInput, lat: mockLat, lng: mockLng }));
      setIsEditingLocation(false);
      Alert.alert('Sukces', 'Lokalizacja została zaktualizowana.');
    } catch (error: any) {
      console.error('Update location error:', error);
      Alert.alert('Błąd', 'Nie udało się zaktualizować lokalizacji.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderCandidateProfile = () => (
    <>
      <View style={styles.header}>
        <View style={styles.avatarFrame}>
          <Avatar.Image size={100} source={{ uri: profile?.avatar_url }} style={styles.avatar} />
          <IconButton
            icon="camera"
            size={20}
            containerColor={Colors.primary}
            iconColor="#fff"
            style={styles.editAvatarBtn}
            onPress={pickAndUploadImage}
            loading={uploading}
          />
        </View>
        <Text variant="headlineSmall" style={styles.name}>{profile?.full_name}</Text>
        {candidateDetails?.superpower && (
          <Chip style={styles.superpowerBadge} textStyle={styles.superpowerText}>{candidateDetails.superpower}</Chip>
        )}
        
        <View style={styles.xpContainer}>
          <View style={styles.xpTextRow}>
            <Text variant="labelLarge" style={styles.xpLabel}>Poziom: Mid</Text>
            <Text variant="labelMedium" style={styles.xpValue}>650 / 1000 XP</Text>
          </View>
          <ProgressBar progress={0.65} color={Colors.xpBar} style={styles.xpBar} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text variant="headlineMedium" style={styles.statValue}>12</Text>
            <Text variant="labelSmall" style={styles.statLabel}>Matchy</Text>
          </View>
          <View style={[styles.statItem, styles.statDivider]}>
            <Text variant="headlineMedium" style={styles.statValue}>48</Text>
            <Text variant="labelSmall" style={styles.statLabel}>Wyświetleń</Text>
          </View>
          <View style={styles.statItem}>
            <Text variant="headlineMedium" style={styles.statValue}>85%</Text>
            <Text variant="labelSmall" style={styles.statLabel}>Dopasowania</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <List.Section>
          <List.Subheader style={styles.listSubheader}>Moje Dane & Prywatność</List.Subheader>
          <List.Item
            title="Tryb Blind Hiring"
            description={candidateDetails?.blind_hiring ? "Włączony (Rozmyte zdjęcie)" : "Wyłączony"}
            left={props => <List.Icon {...props} icon={candidateDetails?.blind_hiring ? "eye-off" : "eye"} color={Colors.primary} />}
            right={props => (
              <Text {...props} style={{ color: candidateDetails?.blind_hiring ? Colors.secondary : Colors.textLight, alignSelf: 'center', fontFamily: 'Montserrat_700Bold' }}>
                {candidateDetails?.blind_hiring ? 'Włączony' : 'Wyłączony'}
              </Text>
            )}
          />
          <List.Item
            title="Moja Lokalizacja"
            description={profile?.location_name || 'Nie ustawiono'}
            left={props => <List.Icon {...props} icon="map-marker" color={Colors.primary} />}
            right={props => <List.Icon {...props} icon="pencil-outline" color={Colors.textLight} />}
            onPress={() => {
              setLocationLocationInput(profile?.location_name || '');
              setIsEditingLocation(true);
            }}
          />
          <List.Item
            title="Moje Umiejętności"
            description={candidateDetails?.skills?.join(', ')}
            left={props => <List.Icon {...props} icon="star-outline" color={Colors.primary} />}
          />
          <List.Item
            title="Oczekiwania finansowe"
            description={candidateDetails?.salary_expectation || 'Nie ustawiono'}
            left={props => <List.Icon {...props} icon="cash" color={Colors.primary} />}
            right={props => <List.Icon {...props} icon="pencil-outline" color={Colors.textLight} />}
            onPress={() => setIsEditingSalary(true)}
          />
        </List.Section>
      </View>
    </>
  );

  const renderEmployerProfile = () => (
    <>
      <View style={styles.header}>
        <View style={styles.avatarFrame}>
          <Avatar.Image size={100} source={{ uri: profile?.avatar_url }} style={styles.avatar} />
          <IconButton
            icon="camera"
            size={20}
            containerColor={Colors.primary}
            iconColor="#fff"
            style={styles.editAvatarBtn}
            onPress={pickAndUploadImage}
            loading={uploading}
          />
        </View>
        <Text variant="headlineSmall" style={styles.name}>{profile?.full_name}</Text>
        <Text variant="labelMedium" style={styles.companyType}>{employerDetails?.company_description || 'Brak opisu'}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text variant="headlineMedium" style={styles.statValue}>{jobs.length}</Text>
            <Text variant="labelSmall" style={styles.statLabel}>Oferty</Text>
          </View>
          <View style={[styles.statItem, styles.statDivider]}>
            <Text variant="headlineMedium" style={styles.statValue}>20</Text>
            <Text variant="labelSmall" style={styles.statLabel}>Matchy</Text>
          </View>
          <View style={styles.statItem}>
            <Text variant="headlineMedium" style={styles.statValue}>4.8</Text>
            <Text variant="labelSmall" style={styles.statLabel}>Ocena</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <List.Section>
          <List.Subheader style={styles.listSubheader}>Ustawienia firmy</List.Subheader>
          <List.Item
            title="Średnie wynagrodzenie"
            description={employerDetails?.average_salary || 'Nie ustawiono'}
            left={props => <List.Icon {...props} icon="cash" color={Colors.primary} />}
            right={props => <List.Icon {...props} icon="pencil-outline" color={Colors.textLight} />}
            onPress={() => setIsEditingSalary(true)}
          />
          <List.Item
            title="Lokalizacja"
            description={profile?.location_name || 'Nie ustawiono'}
            left={props => <List.Icon {...props} icon="map-marker" color={Colors.primary} />}
            right={props => <List.Icon {...props} icon="pencil-outline" color={Colors.textLight} />}
            onPress={() => {
              setLocationLocationInput(profile?.location_name || '');
              setIsEditingLocation(true);
            }}
          />
        </List.Section>

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>Moje oferty pracy</Text>
          <Button 
            mode="contained" 
            onPress={() => setShowAddJob(true)}
            icon="plus"
            buttonColor={Colors.primary}
            style={styles.addJobBtn}
          >
            Dodaj
          </Button>
        </View>

        <View style={styles.jobsList}>
          {jobs.length > 0 ? jobs.map(job => (
            <Card key={job.id} style={styles.jobCard}>
              <Card.Content style={styles.jobCardContent}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobTitleText}>{job.title}</Text>
                  <Text style={styles.jobSalaryText}>{job.salary}</Text>
                  <View style={styles.locationRow}>
                    <MaterialCommunityIcons name="map-marker" size={14} color={Colors.textLight} />
                    <Text style={styles.jobLocationText}>{job.location}</Text>
                  </View>
                </View>
                <View style={styles.jobMatchesBadge}>
                  <Text style={styles.jobMatchesText}>{job.matches} Matchy</Text>
                </View>
              </Card.Content>
            </Card>
          )) : (
            <Text style={styles.noJobsText}>Nie masz jeszcze żadnych ofert.</Text>
          )}
        </View>
      </View>
    </>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {profile?.role === 'candidate' ? renderCandidateProfile() : renderEmployerProfile()}

      <View style={styles.section}>
        <Divider />
        <List.Section>
          <List.Subheader style={styles.listSubheader}>Ustawienia</List.Subheader>
          <Button 
            mode="contained" 
            onPress={handleLogout}
            buttonColor={Colors.error}
            style={styles.logoutBtn}
            icon="logout"
          >
            Wyloguj się
          </Button>
          <List.Item
            title="Pomoc i Wsparcie"
            left={props => <List.Icon {...props} icon="help-circle" color={Colors.primary} />}
          />
        </List.Section>
      </View>

      {/* Modal dodawania oferty */}
      <Modal visible={showAddJob} onDismiss={() => setShowAddJob(false)} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>Nowa oferta pracy</Text>
              <IconButton icon="close" onPress={() => setShowAddJob(false)} />
            </View>

            <TextInput
              label="Nazwa stanowiska"
              value={newJob.title}
              onChangeText={(text) => setNewJob({...newJob, title: text})}
              mode="outlined"
              style={styles.modalInput}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
            <TextInput
              label="Widełki płacowe (np. 30-40 PLN/h)"
              value={newJob.salary}
              onChangeText={(text) => setNewJob({...newJob, salary: text})}
              mode="outlined"
              style={styles.modalInput}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
            <TextInput
              label="Lokalizacja"
              value={newJob.locationName}
              onChangeText={(text) => setNewJob({...newJob, locationName: text})}
              mode="outlined"
              style={styles.modalInput}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />

            <Button 
              mode="contained" 
              onPress={handleAddJob}
              style={styles.modalSubmitBtn}
              buttonColor={Colors.primary}
              contentStyle={styles.modalSubmitBtnContent}
            >
              Opublikuj ofertę
            </Button>
          </View>
        </View>
      </Modal>

      {/* Modal edycji wynagrodzenia */}
      <Modal visible={isEditingSalary} onDismiss={() => setIsEditingSalary(false)} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                {profile?.role === 'candidate' ? 'Twoje oczekiwania' : 'Średnie zarobki'}
              </Text>
              <IconButton icon="close" onPress={() => setIsEditingSalary(false)} />
            </View>

            <View style={styles.chipContainer}>
              {Config.SALARY_RANGES.map(range => (
                <Chip 
                  key={range}
                  selected={
                    profile?.role === 'candidate' 
                    ? candidateDetails?.salary_expectation === range 
                    : employerDetails?.average_salary === range
                  }
                  onPress={() => updateSalary(range)}
                  style={[
                    styles.chip,
                    (profile?.role === 'candidate' 
                      ? candidateDetails?.salary_expectation === range 
                      : employerDetails?.average_salary === range) && { backgroundColor: Colors.primary }
                  ]}
                  showSelectedCheck={false}
                  selectedColor={
                    (profile?.role === 'candidate' 
                      ? candidateDetails?.salary_expectation === range 
                      : employerDetails?.average_salary === range) ? '#fff' : Colors.text
                  }
                >
                  {range}
                </Chip>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal edycji lokalizacji */}
      <Modal visible={isEditingLocation} onDismiss={() => setIsEditingLocation(false)} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>Ustaw lokalizację</Text>
              <IconButton icon="close" onPress={() => setIsEditingLocation(false)} />
            </View>

            <TextInput
              label="Miejscowość"
              value={locationInput}
              onChangeText={setLocationLocationInput}
              mode="outlined"
              style={styles.modalInput}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              placeholder="np. Warszawa, Kraków..."
            />

            <Button 
              mode="contained" 
              onPress={updateLocation}
              style={styles.modalSubmitBtn}
              buttonColor={Colors.primary}
              contentStyle={styles.modalSubmitBtnContent}
            >
              Zapisz lokalizację
            </Button>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarFrame: {
    backgroundColor: '#fff',
    borderRadius: 50,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
    position: 'relative',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    margin: 0,
  },
  avatar: {
    backgroundColor: Colors.primary,
  },
  name: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.text,
  },
  companyType: {
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  superpowerBadge: {
    backgroundColor: Colors.xpBar,
    marginTop: 8,
    height: 32,
  },
  superpowerText: {
    color: '#000',
    fontFamily: 'Montserrat_700Bold',
  },
  xpContainer: {
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 10,
  },
  xpTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  xpLabel: {
    color: Colors.text,
    fontFamily: 'Montserrat_700Bold',
  },
  xpValue: {
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
  },
  xpBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 32,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.primary,
  },
  statLabel: {
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 20,
    backgroundColor: Colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
  },
  addJobBtn: {
    borderRadius: 12,
  },
  jobsList: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  jobCard: {
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 0,
  },
  jobCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobInfo: {
    gap: 4,
  },
  jobTitleText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  jobSalaryText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: Colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobLocationText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textLight,
  },
  jobMatchesBadge: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  jobMatchesText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.primary,
  },
  noJobsText: {
    textAlign: 'center',
    color: Colors.textLight,
    fontFamily: 'Montserrat_400Regular',
    padding: 20,
  },
  logoutBtn: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    elevation: 4,
  },
  listSubheader: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.primary,
    paddingTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
  },
  modalInput: {
    backgroundColor: Colors.surface,
  },
  modalSubmitBtn: {
    marginTop: 8,
    borderRadius: 16,
  },
  modalSubmitBtnContent: {
    paddingVertical: 12,
  },
});
