import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import { Avatar, Text, Button, List, Divider, ProgressBar, Chip, IconButton, TextInput, Card, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Config } from '../../constants/Config';
import { useState, useEffect } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, uploadAvatar } from '../../src/lib/supabase';
import { logger } from '../../src/lib/logger';
import LocationPicker from '../../components/LocationPicker';
import ImageEditorModal from '../../components/ImageEditorModal';

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
  bio?: string;
  experience_history?: { company: string; position: string; period: string }[];
  availability_status?: string;
  personality_traits?: { label: string; value: number }[];
}

interface EmployerDetails {
  company_name: string;
  company_description: string;
  average_salary?: string;
  is_verified?: boolean;
  nip?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<CandidateDetails | null>(null);
  const [employerDetails, setEmployerDetails] = useState<EmployerDetails | null>(null);
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [newJob, setNewJob] = useState({ 
    title: '', 
    salary: '', 
    locationName: '', 
    lat: 0, 
    lng: 0,
    description: '',
    requiredSkills: '' 
  });
  const [jobErrors, setJobErrors] = useState<{
    title?: string, 
    salary?: string, 
    location?: string,
    description?: string
  }>({});
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isEditingExp, setIsEditingExp] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [tempExp, setTempExp] = useState({ company: '', position: '', period: '' });
  const [uploading, setUploading] = useState(false);
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);

  // Image editing state
  const [editorVisible, setEditorVisible] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (candidateDetails?.bio) {
      setNewBio(candidateDetails.bio);
    }
  }, [candidateDetails]);

  const validateJob = () => {
    const errors: {title?: string, salary?: string, location?: string, description?: string} = {};
    
    if (!newJob.title.trim()) {
      errors.title = 'Tytuł stanowiska jest wymagany';
    } else if (newJob.title.length < 3) {
      errors.title = 'Tytuł jest za krótki (min. 3 znaki)';
    }

    if (!newJob.salary.trim()) {
      errors.salary = 'Podaj kwotę wynagrodzenia';
    } else if (newJob.salary.toLowerCase() === 'do uzgodnienia') {
      // Akceptujemy tę frazę
    } else if (!/\d/.test(newJob.salary)) {
      errors.salary = 'Kwota musi zawierać cyfry';
    } else if (!newJob.salary.toLowerCase().includes('pln')) {
      errors.salary = 'Dodaj walutę (np. PLN) lub wpisz "Do uzgodnienia"';
    }

    if (!newJob.locationName || !newJob.lat) {
      errors.location = 'Wybierz miejscowość z listy podpowiedzi';
    }

    if (!newJob.description.trim()) {
      errors.description = 'Opis stanowiska jest wymagany';
    } else if (newJob.description.length < 20) {
      errors.description = 'Opis musi mieć przynajmniej 20 znaków';
    }
    
    setJobErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogout = async () => {
    logger.action('Wyloguj (Hard Reset)');
    try {
      // 1. Wyloguj w Supabase
      await supabase.auth.signOut();
      
      // 2. Najbardziej radykalne rozwiązanie: przeładuj całą aplikację
      // To wymusi wyczyszczenie wszystkich stanów, pamięci i nawigacji
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        // W React Native/Expo Updates możemy użyć reloadAsync, ale najprościej 
        // i najskuteczniej będzie po prostu przekierować do root i pozwolić globalnemu listenerowi zadziałać
        router.replace('/');
      }
    } catch (error: any) {
      console.error('Logout error:', error);
      router.replace('/');
    }
  };

  const pickAndUploadImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // Wyłączamy wbudowane edytowanie
        quality: 0.8,
      });

      if (!result.canceled && profile) {
        setTempImageUri(result.assets[0].uri);
        setEditorVisible(true);
      }
    } catch (error: any) {
      Alert.alert('Błąd', 'Nie udało się otworzyć galerii zdjęć.');
    }
  };

  const handleSaveEditedImage = async (uri: string) => {
    if (!profile) return;
    
    try {
      setEditorVisible(false);
      setUploading(true);
      const publicUrl = await uploadAvatar(uri, profile.id);
      
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, avatar_url: publicUrl });
      Alert.alert('Sukces', 'Zdjęcie profilowe zostało zaktualizowane.');
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
          .eq('employer_id', user.id)
          .order('created_at', { ascending: false });
        if (jobsError) throw jobsError;
        setJobs(jobsData.map((j: any) => ({
          id: j.id,
          title: j.title,
          salary: j.salary_range,
          location: j.location_name,
          description: j.description,
          required_skills: j.required_skills,
          lat: j.lat,
          lng: j.lng,
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
    if (!validateJob()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const jobData = {
        employer_id: user.id,
        title: newJob.title,
        salary_range: newJob.salary,
        location_name: newJob.locationName,
        lat: newJob.lat,
        lng: newJob.lng,
        description: newJob.description,
        required_skills: newJob.requiredSkills ? (Array.isArray(newJob.requiredSkills) ? newJob.requiredSkills : newJob.requiredSkills.split(',').map(s => s.trim())) : []
      };

      if (editingJobId) {
        // Tryb edycji
        const { error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', editingJobId);

        if (error) throw error;

        setJobs(jobs.map(j => j.id === editingJobId ? {
          ...j,
          title: newJob.title,
          salary: newJob.salary,
          location: newJob.locationName,
          description: newJob.description,
          required_skills: jobData.required_skills
        } : j));
        
        Alert.alert('Sukces', 'Oferta została zaktualizowana.');
      } else {
        // Tryb dodawania
        const { data, error } = await supabase
          .from('jobs')
          .insert(jobData)
          .select()
          .single();

        if (error) throw error;

        setJobs([{
          id: data.id,
          title: data.title,
          salary: data.salary_range,
          location: data.location_name,
          description: data.description,
          required_skills: data.required_skills,
          matches: 0
        }, ...jobs]);
        
        Alert.alert('Sukces', 'Oferta pracy została dodana!');
      }

      setNewJob({ 
        title: '', 
        salary: '', 
        locationName: '', 
        lat: 0, 
        lng: 0, 
        description: '', 
        requiredSkills: '' 
      });
      setEditingJobId(null);
      setJobErrors({});
      setShowAddJob(false);
    } catch (error: any) {
      logger.error('Error saving job', error);
      Alert.alert('Błąd', 'Nie udało się zapisać oferty.');
    }
  };

  const handleDeleteJob = async (id: string) => {
    Alert.alert(
      'Usuń ofertę',
      'Czy na pewno chcesz trwale usunąć tę ofertę pracy?',
      [
        { text: 'Anuluj', style: 'cancel' },
        { 
          text: 'Usuń', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('jobs')
                .delete()
                .eq('id', id);

              if (error) throw error;

              setJobs(jobs.filter(j => j.id !== id));
              Alert.alert('Sukces', 'Oferta została usunięta.');
            } catch (error: any) {
              logger.error('Delete job error', error);
              Alert.alert('Błąd', 'Nie udało się usunąć oferty.');
            }
          }
        }
      ]
    );
  };

  const openEditJob = (job: any) => {
    setEditingJobId(job.id);
    setNewJob({
      title: job.title,
      salary: job.salary,
      locationName: job.location,
      lat: job.lat || 0,
      lng: job.lng || 0,
      description: job.description || '',
      requiredSkills: Array.isArray(job.required_skills) ? job.required_skills.join(', ') : (job.required_skills || '')
    });
    setShowAddJob(true);
  };

  const updateSalary = async (newSalary: string) => {
    logger.action('Wybór wynagrodzenia', { salary: newSalary, role: profile?.role });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (profile?.role === 'candidate') {
        const { error } = await supabase
          .from('candidates')
          .update({ salary_expectation: newSalary })
          .eq('id', user.id);
        if (error) throw error;
        setCandidateDetails(prev => prev ? { ...prev, salary_expectation: newSalary } : null);
      } else {
        const { error } = await supabase
          .from('employers')
          .update({ average_salary: newSalary })
          .eq('id', user.id);
        if (error) throw error;
        setEmployerDetails(prev => prev ? { ...prev, average_salary: newSalary } : null);
      }
      setIsEditingSalary(false);
      Alert.alert('Sukces', 'Wynagrodzenie zostało zaktualizowane.');
    } catch (error: any) {
      logger.error('Update salary error', error);
      Alert.alert('Błąd', 'Nie udało się zaktualizować wynagrodzenia.');
    }
  };

  const updateLocation = async (loc: { name: string; lat: number; lng: number }) => {
    try {
      setLoading(true);
      logger.action('Zaktualizowano lokalizację w profilu', { location: loc.name });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          location_name: loc.name,
          lat: loc.lat,
          lng: loc.lng
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, location_name: loc.name, lat: loc.lat, lng: loc.lng } : null);
      setIsEditingLocation(false);
      Alert.alert('Sukces', 'Lokalizacja została zaktualizowana.');
    } catch (error: any) {
      logger.error('Update location error', error);
      Alert.alert('Błąd', 'Nie udało się zaktualizować lokalizacji.');
    } finally {
      setLoading(false);
    }
  };

  const updateBio = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('candidates')
        .update({ bio: newBio })
        .eq('id', user.id);

      if (error) throw error;
      setCandidateDetails(prev => prev ? { ...prev, bio: newBio } : null);
      setIsEditingBio(false);
      Alert.alert('Sukces', 'Twój opis został zaktualizowany.');
    } catch (error: any) {
      logger.error('Update bio error', error);
      Alert.alert('Błąd', 'Nie udało się zaktualizować opisu.');
    }
  };

  const updateExperience = async (newList: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('candidates')
        .update({ experience_history: newList })
        .eq('id', user.id);

      if (error) throw error;
      setCandidateDetails(prev => prev ? { ...prev, experience_history: newList } : null);
      Alert.alert('Sukces', 'Historia pracy została zaktualizowana.');
    } catch (error: any) {
      logger.error('Update experience error', error);
      Alert.alert('Błąd', 'Nie udało się zaktualizować doświadczenia.');
    }
  };

  const updateAvailability = async (status: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('candidates')
        .update({ availability_status: status })
        .eq('id', user.id);

      if (error) throw error;
      setCandidateDetails(prev => prev ? { ...prev, availability_status: status } : null);
      setIsEditingAvailability(false);
      Alert.alert('Sukces', 'Status dostępności został zaktualizowany.');
    } catch (error: any) {
      logger.error('Update availability error', error);
      Alert.alert('Błąd', 'Nie udało się zaktualizować statusu.');
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
        
        {/* Nowa sekcja: Status Dostępności */}
        <View style={styles.availabilityContainer}>
          <TouchableOpacity 
            style={[
              styles.availabilityBadge, 
              { backgroundColor: candidateDetails?.availability_status === 'Dostępny od zaraz' ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 152, 0, 0.1)' }
            ]}
            onPress={() => setIsEditingAvailability(true)}
          >
            <MaterialCommunityIcons 
              name="clock-check-outline" 
              size={18} 
              color={candidateDetails?.availability_status === 'Dostępny od zaraz' ? Colors.primary : '#FF9800'} 
            />
            <Text style={[
              styles.availabilityText, 
              { color: candidateDetails?.availability_status === 'Dostępny od zaraz' ? Colors.primary : '#FF9800' }
            ]}>
              {candidateDetails?.availability_status || 'Ustaw dostępność'}
            </Text>
            <MaterialCommunityIcons name="pencil" size={12} color={Colors.textLight} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* Nowa sekcja: Radar Skilli / Cech osobowości */}
        <View style={styles.radarSection}>
          <Text style={styles.radarTitle}>Profil zawodowy</Text>
          <View style={styles.radarGrid}>
            {(candidateDetails?.personality_traits || [
              { label: 'Punktualność', value: 0.9 },
              { label: 'Praca w zespole', value: 0.85 },
              { label: 'Elastyczność', value: 0.7 },
              { label: 'Komunikacja', value: 0.95 }
            ]).map((trait, idx) => (
              <View key={idx} style={styles.radarItem}>
                <View style={styles.traitLabelRow}>
                  <Text style={styles.traitLabel}>{trait.label}</Text>
                  <Text style={styles.traitValue}>{Math.round(trait.value * 100)}%</Text>
                </View>
                <ProgressBar progress={trait.value} color={Colors.primary} style={styles.traitBar} />
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <List.Section>
          <List.Subheader style={styles.listSubheader}>O mnie (Bio)</List.Subheader>
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={styles.bioText}>
              {candidateDetails?.bio || 'Nie dodano jeszcze opisu. Kliknij edytuj, aby opowiedzieć o sobie.'}
            </Text>
            <Button 
              mode="text" 
              onPress={() => setIsEditingBio(true)}
              style={{ alignSelf: 'flex-end' }}
              textColor={Colors.primary}
              icon="pencil"
            >
              Edytuj opis
            </Button>
          </View>
        </List.Section>
      </View>

      <View style={styles.section}>
        <List.Section>
          <List.Subheader style={styles.listSubheader}>Doświadczenie zawodowe</List.Subheader>
          {candidateDetails?.experience_history && candidateDetails.experience_history.length > 0 ? (
            candidateDetails.experience_history.map((exp, index) => (
              <List.Item
                key={index}
                title={exp.position}
                description={`${exp.company} | ${exp.period}`}
                left={props => <List.Icon {...props} icon="briefcase-outline" color={Colors.primary} />}
                right={props => (
                  <IconButton 
                    {...props} 
                    icon="delete-outline" 
                    onPress={() => {
                      const newList = [...candidateDetails.experience_history!];
                      newList.splice(index, 1);
                      updateExperience(newList);
                    }} 
                  />
                )}
              />
            ))
          ) : (
            <Text style={styles.noJobsText}>Brak historii zatrudnienia.</Text>
          )}
          <Button 
            mode="contained" 
            onPress={() => setIsEditingExp(true)}
            style={{ margin: 16, borderRadius: 12 }}
            buttonColor={Colors.primary}
            icon="plus"
          >
            Dodaj doświadczenie
          </Button>
        </List.Section>
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
            onPress={() => setIsEditingLocation(true)}
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
            onPress={() => setIsEditingLocation(true)}
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
                <View style={styles.jobActions}>
                  <IconButton 
                    icon="pencil-outline" 
                    size={20} 
                    onPress={() => openEditJob(job)} 
                    iconColor={Colors.primary}
                  />
                  <IconButton 
                    icon="delete-outline" 
                    size={20} 
                    onPress={() => handleDeleteJob(job.id)} 
                    iconColor={Colors.error}
                  />
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
      <Modal visible={showAddJob} onDismiss={() => {
        setShowAddJob(false);
        setEditingJobId(null);
        setNewJob({ title: '', salary: '', locationName: '', lat: 0, lng: 0, description: '', requiredSkills: '' });
      }} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                {editingJobId ? 'Edytuj ofertę' : 'Nowa oferta pracy'}
              </Text>
              <IconButton icon="close" onPress={() => {
                setShowAddJob(false);
                setEditingJobId(null);
                setNewJob({ title: '', salary: '', locationName: '', lat: 0, lng: 0, description: '', requiredSkills: '' });
              }} />
            </View>

            <View>
              <TextInput
                label="Nazwa stanowiska"
                value={newJob.title}
                onChangeText={(text) => {
                  setNewJob({...newJob, title: text});
                  if (jobErrors.title) setJobErrors({...jobErrors, title: undefined});
                }}
                mode="outlined"
                error={!!jobErrors.title}
                style={styles.modalInput}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
              />
              {jobErrors.title && <Text style={styles.errorText}>{jobErrors.title}</Text>}
            </View>

            <View>
              <TextInput
                label="Widełki płacowe (np. 30-40 PLN/h)"
                value={newJob.salary}
                onChangeText={(text) => {
                  setNewJob({...newJob, salary: text});
                  if (jobErrors.salary) setJobErrors({...jobErrors, salary: undefined});
                }}
                mode="outlined"
                error={!!jobErrors.salary}
                style={styles.modalInput}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                right={
                  <TextInput.Icon 
                    icon="hand-coin-outline" 
                    onPress={() => setNewJob({...newJob, salary: 'Do uzgodnienia'})}
                  />
                }
              />
              {jobErrors.salary && <Text style={styles.errorText}>{jobErrors.salary}</Text>}
              <TouchableOpacity 
                onPress={() => setNewJob({...newJob, salary: 'Do uzgodnienia'})}
                style={{ marginTop: 4, marginLeft: 4 }}
              >
                <Text style={{ color: Colors.primary, fontSize: 12 }}>Ustaw "Do uzgodnienia"</Text>
              </TouchableOpacity>
            </View>

            <View style={{ zIndex: 1000 }}>
              <LocationPicker 
                label="Lokalizacja"
                onLocationSelect={(loc) => {
                  setNewJob({ ...newJob, locationName: loc.name, lat: loc.lat, lng: loc.lng });
                  if (jobErrors.location) setJobErrors({...jobErrors, location: undefined});
                }}
                placeholder="Lokalizacja oferty..."
              />
              {jobErrors.location && <Text style={styles.errorText}>{jobErrors.location}</Text>}
            </View>

            <View>
              <TextInput
                label="Opis stanowiska"
                value={newJob.description}
                onChangeText={(text) => {
                  setNewJob({...newJob, description: text});
                  if (jobErrors.description) setJobErrors({...jobErrors, description: undefined});
                }}
                mode="outlined"
                error={!!jobErrors.description}
                multiline
                numberOfLines={4}
                style={styles.modalInput}
                outlineColor={Colors.border}
                activeOutlineColor={Colors.primary}
                placeholder="Napisz czego oczekujesz od pracownika..."
              />
              {jobErrors.description && <Text style={styles.errorText}>{jobErrors.description}</Text>}
            </View>

            <TextInput
              label="Wymagane umiejętności (opcjonalnie, po przecinku)"
              value={newJob.requiredSkills}
              onChangeText={(text) => setNewJob({...newJob, requiredSkills: text})}
              mode="outlined"
              style={styles.modalInput}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
              placeholder="np. Prawo jazdy, Angielski, Punktualność"
            />

            <Button 
              mode="contained" 
              onPress={handleAddJob}
              style={styles.modalSubmitBtn}
              buttonColor={Colors.primary}
              contentStyle={styles.modalSubmitBtnContent}
            >
              {editingJobId ? 'Zapisz zmiany' : 'Opublikuj ofertę'}
            </Button>
          </View>
        </View>
      </Modal>

      {/* Modal edycji wynagrodzenia */}
      <Modal 
        visible={isEditingSalary} 
        onRequestClose={() => setIsEditingSalary(false)} 
        transparent={true} 
        animationType="slide"
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsEditingSalary(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                {profile?.role === 'candidate' ? 'Twoje oczekiwania' : 'Średnie zarobki'}
              </Text>
              <IconButton icon="close" onPress={() => setIsEditingSalary(false)} />
            </View>

            <View style={styles.chipContainer}>
              {Config.SALARY_RANGES
                .filter(range => 
                  profile?.role === 'candidate' 
                  ? range !== 'Do uzgodnienia' 
                  : range !== 'Jeszcze nie wiem'
                )
                .map(range => (
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
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji Bio */}
      <Modal 
        visible={isEditingBio} 
        onRequestClose={() => setIsEditingBio(false)} 
        transparent={true} 
        animationType="slide"
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsEditingBio(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>O mnie</Text>
              <IconButton icon="close" onPress={() => setIsEditingBio(false)} />
            </View>
            <TextInput
              label="Opis profilu"
              value={newBio}
              onChangeText={setNewBio}
              mode="outlined"
              multiline
              numberOfLines={6}
              style={styles.modalInput}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
            <Button 
              mode="contained" 
              onPress={updateBio}
              style={styles.modalSubmitBtn}
              buttonColor={Colors.primary}
            >
              Zapisz opis
            </Button>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji Dostępności */}
      <Modal 
        visible={isEditingAvailability} 
        onRequestClose={() => setIsEditingAvailability(false)} 
        transparent={true} 
        animationType="slide"
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsEditingAvailability(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>Kiedy możesz pracować?</Text>
              <IconButton icon="close" onPress={() => setIsEditingAvailability(false)} />
            </View>
            <View style={styles.chipContainer}>
              {['Od zaraz', 'W tygodniu', 'Tylko weekendy', 'Wieczorami', 'Dorywczo', 'Obecnie zatrudniony', 'Okres wypowiedzenia'].map(status => (
                <Chip 
                  key={status}
                  selected={candidateDetails?.availability_status === status}
                  onPress={() => updateAvailability(status)}
                  style={[
                    styles.chip,
                    candidateDetails?.availability_status === status && { backgroundColor: Colors.primary }
                  ]}
                  textStyle={[
                    styles.chipText,
                    candidateDetails?.availability_status === status && { color: '#fff' }
                  ]}
                  showSelectedCheck={false}
                >
                  {status}
                </Chip>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji doświadczenia */}
      <Modal 
        visible={isEditingExp} 
        onRequestClose={() => setIsEditingExp(false)} 
        transparent={true} 
        animationType="slide"
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsEditingExp(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>Dodaj doświadczenie</Text>
              <IconButton icon="close" onPress={() => setIsEditingExp(false)} />
            </View>
            <TextInput
              label="Firma"
              value={tempExp.company}
              onChangeText={(text) => setTempExp({...tempExp, company: text})}
              mode="outlined"
              style={styles.modalInput}
            />
            <TextInput
              label="Stanowisko"
              value={tempExp.position}
              onChangeText={(text) => setTempExp({...tempExp, position: text})}
              mode="outlined"
              style={styles.modalInput}
            />
            <TextInput
              label="Okres"
              value={tempExp.period}
              onChangeText={(text) => setTempExp({...tempExp, period: text})}
              mode="outlined"
              style={styles.modalInput}
            />
            <Button 
              mode="contained" 
              onPress={() => {
                if (tempExp.company && tempExp.position) {
                  const newList = [...(candidateDetails?.experience_history || []), tempExp];
                  updateExperience(newList);
                  setTempExp({ company: '', position: '', period: '' });
                  setIsEditingExp(false);
                }
              }}
              style={styles.modalSubmitBtn}
              buttonColor={Colors.primary}
            >
              Dodaj do profilu
            </Button>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji lokalizacji */}
      <Modal 
        visible={isEditingLocation} 
        onRequestClose={() => setIsEditingLocation(false)} 
        transparent={true} 
        animationType="slide"
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsEditingLocation(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text variant="headlineSmall" style={styles.modalTitle}>Ustaw lokalizację</Text>
              <IconButton icon="close" onPress={() => setIsEditingLocation(false)} />
            </View>

            <LocationPicker 
              label="Miasto / Miejscowość"
              onLocationSelect={updateLocation}
              placeholder="Wyszukaj miasto..."
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <ImageEditorModal 
        visible={editorVisible}
        imageUri={tempImageUri}
        onSave={handleSaveEditedImage}
        onCancel={() => setEditorVisible(false)}
      />
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
  availabilityContainer: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  availabilityText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
  },
  radarSection: {
    width: '100%',
    marginTop: 24,
    padding: 20,
    backgroundColor: Colors.background,
    borderRadius: 24,
  },
  radarTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  radarGrid: {
    gap: 16,
  },
  radarItem: {
    width: '100%',
  },
  traitLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  traitLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  traitValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: Colors.primary,
  },
  traitBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
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
  jobActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noJobsText: {
    textAlign: 'center',
    color: Colors.textLight,
    fontFamily: 'Montserrat_400Regular',
    padding: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    marginTop: 4,
    marginLeft: 4,
  },
  logoutBtn: {
    margin: 16,
    borderRadius: 12,
  },
  listSubheader: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.primary,
    paddingTop: 16,
  },
  bioText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  chipText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
  },
});
