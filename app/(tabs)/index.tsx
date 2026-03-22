import { View, StyleSheet, Dimensions, Animated, PanResponder, ImageBackground, Image, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { Card, Text, Button, Chip, IconButton, Portal, Dialog, Divider, SegmentedButtons } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { Config } from '../../constants/Config';
import { supabase } from '../../src/lib/supabase';
import { logger } from '../../src/lib/logger';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MatchModal from '../../components/MatchModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;
const FORCE_SWIPE_DURATION = 250;

interface CardData {
  id: string;
  type: 'job' | 'candidate';
  title: string;
  subtitle: string;
  image: string;
  price: string;
  tags: { icon: string; text: string }[];
  matchScore?: number;
  isBlurred?: boolean;
  isVerified?: boolean;
  bio?: string;
  description?: string;
  experience?: string;
  experienceHistory?: any[];
  locationName?: string;
  lat?: number;
  lng?: number;
}

// Haversine formula to calculate distance between two points in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return Math.round(d);
};

// Formats full name to "Firstname L."
const formatDisplayName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
};

export default function SwipeScreen() {
  const [index, setIndex] = useState(0);
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchedItem, setMatchedItem] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardData[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [filters, setFilters] = useState({
    radius: 20,
    salaryMin: 0,
    salaryMax: 1000, // Dla pracodawców szukających kandydatów
    experience: [] as string[], // ['Junior', 'Mid', 'Senior']
  });
  const position = useRef(new Animated.ValueXY()).current;
  const router = useRouter();

  // Load filters from storage on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const saved = await AsyncStorage.getItem('fajnarobota_filters');
        if (saved) {
          setFilters(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Error loading filters', e);
      }
    };
    loadFilters();
  }, []);

  // Save filters whenever they change
  useEffect(() => {
    AsyncStorage.setItem('fajnarobota_filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, []); // Refetch only on mount

  const handleApplyFilters = () => {
    setShowFilterDialog(false);
    fetchData();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('No user found in fetchData');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!profile) {
        logger.error('Profile not found for user', { userId: user.id });
        return;
      }
      
      setUserProfile(profile);
      logger.info('User profile loaded', { role: profile.role, location: profile.location_name });

      // Pobierz ID już przesuniętych kart
      const { data: swiped } = await supabase
        .from('swipes')
        .select('target_id')
        .eq('swiper_id', user.id);
      
      const swipedIds = swiped?.map(s => s.target_id) || [];

      if (profile?.role === 'candidate') {
        // Kandydat widzi oferty pracy w promieniu
        let { data: jobs, error: jobsError } = await supabase
          .rpc('get_jobs_within_radius', {
            user_lat: profile.lat || 52.2297, // Fallback do Warszawy jeśli brak w profilu
            user_lng: profile.lng || 21.0122,
            radius_km: filters.radius
          });
        
        if (jobsError) {
          logger.error('Error fetching jobs within radius', jobsError);
          throw jobsError;
        }

        logger.info(`Fetched ${jobs?.length || 0} jobs within radius ${filters.radius}km`);

        // Filtruj już swipe'owane
        if (swipedIds.length > 0) {
          jobs = jobs?.filter((j: any) => !swipedIds.includes(j.id)) || [];
        }

        // Filtruj po wynagrodzeniu (client-side because salary_range is text)
        if (filters.salaryMin > 0 && jobs) {
          jobs = jobs.filter((j: any) => {
            const salary = parseInt(j.salary_range?.replace(/[^0-9]/g, '') || '0');
            return salary >= filters.salaryMin;
          });
        }
        
        if (jobs && jobs.length > 0) {
          // Pobierz nazwy firm i logo dla tych ofert, w tym is_verified z tabeli employers
          const employerIds = [...new Set(jobs.map((j: any) => j.employer_id))];
          const { data: employers } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, employers(is_verified)')
            .in('id', employerIds);

          const jobCards: CardData[] = jobs.map((job: any) => {
            const employer = employers?.find(e => e.id === job.employer_id);
            return {
              id: job.id,
              type: 'job',
              title: job.title,
              subtitle: employer?.full_name || 'Firma',
              image: employer?.avatar_url || `https://picsum.photos/seed/${job.id}/600/800`,
              price: job.salary_range || 'Do uzgodnienia',
              description: job.description,
              tags: [
                { icon: 'map-marker', text: job.location_name || 'Lokalizacja' },
                { icon: 'briefcase-outline', text: 'Stacjonarnie' },
              ],
              isVerified: employer?.employers?.[0]?.is_verified || false,
              locationName: job.location_name,
              lat: job.lat,
              lng: job.lng,
            };
          });
          setCards(jobCards);
        } else {
          setCards([]);
          // setShowRadiusDialog(true); // Don't auto-show, user has manual filter now
        }
      } else {
        // Pracodawca widzi kandydatów, których jeszcze nie ocenił
        let query = supabase
          .from('candidates')
          .select('*, profiles(full_name, avatar_url, location_name, lat, lng, employers(is_verified))');
        
        if (swipedIds.length > 0) {
          query = query.not('id', 'in', `(${swipedIds.join(',')})`);
        }

        // Filtruj po doświadczeniu (SQL)
        if (filters.experience.length > 0) {
          query = query.in('experience', filters.experience);
        }

        const { data: candidates } = await query;
        
        if (candidates) {
          let candidateCards: CardData[] = candidates.map(cand => {
            const fullName = cand.profiles?.full_name || 'Kandydat';
            const age = cand.age ? ` ${cand.age}` : '';
            
            // Parsowanie bio (może być JSONem z dostępnością)
            let displayBio = cand.bio || '';
            let availability = '';
            try {
              if (displayBio.startsWith('{')) {
                const bioData = JSON.parse(displayBio);
                displayBio = bioData.text || '';
                availability = bioData.availability || '';
              }
            } catch (e) {
              // Jeśli to nie JSON, zostawiamy jak jest
            }
            
            const tags = (cand.skills || []).map((skill: string) => ({ icon: 'star-outline', text: skill }));
            if (availability) {
              tags.unshift({ icon: 'clock-outline', text: availability });
            }
            
            return {
              id: cand.id,
              type: 'candidate',
              title: `${formatDisplayName(fullName)}${age}`,
              subtitle: cand.superpower || 'Bohater',
              image: cand.profiles?.avatar_url || `https://picsum.photos/seed/${cand.id}/600/800`,
              price: `Min. ${cand.salary_expectation} zł/h`,
              tags: tags,
              matchScore: 85 + Math.floor(Math.random() * 15),
              isBlurred: cand.blind_hiring,
              bio: displayBio,
              experienceHistory: cand.experience_history,
              locationName: cand.profiles?.location_name,
              lat: cand.profiles?.lat,
              lng: cand.profiles?.lng,
              salaryExpectation: parseInt(cand.salary_expectation?.replace(/[^0-9]/g, '') || '0')
            };
          });

          // Filtruj po dystansie (client-side)
          if (profile.lat && profile.lng) {
            candidateCards = candidateCards.filter(c => {
              if (!c.lat || !c.lng) return true; // Keep if no location info
              return calculateDistance(profile.lat, profile.lng, c.lat, c.lng) <= filters.radius;
            });
          }

          // Filtruj po oczekiwaniach finansowych (salaryMax)
          if (filters.salaryMax < 1000) {
            candidateCards = candidateCards.filter(c => (c as any).salaryExpectation <= filters.salaryMax);
          }

          setCards(candidateCards);
        }
      }
    } catch (error: any) {
      logger.error('Error fetching swipe data', error);
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (event, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const forceSwipe = (direction: 'right' | 'left') => {
    const x = direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: FORCE_SWIPE_DURATION,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = async (direction: 'right' | 'left') => {
    const item = cards[index];
    if (!item) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Zapisz swipe w bazie
      await supabase.from('swipes').insert({
        swiper_id: user.id,
        target_id: item.id,
        direction: direction
      });

      // 2. Jeśli swipe w prawo, sprawdź czy jest Match
      if (direction === 'right') {
        let isMatch = false;
        let matchData: any = null;
        let fullMatchName = '';

        if (item.type === 'job') {
          // Pobierz pracodawcę tej oferty
          const { data: job } = await supabase
            .from('jobs')
            .select('employer_id, profiles(full_name)')
            .eq('id', item.id)
            .single();
            
          if (job) {
            fullMatchName = (job.profiles as any)?.full_name || item.title;
            // Sprawdź czy pracodawca polubił kandydata
            const { data: employerSwipe } = await supabase
              .from('swipes')
              .select('*')
              .eq('swiper_id', job.employer_id)
              .eq('target_id', user.id)
              .eq('direction', 'right')
              .single();

            if (employerSwipe) {
              isMatch = true;
              matchData = { candidate_id: user.id, employer_id: job.employer_id, job_id: item.id };
            }
          }
        } else {
          // Pracodawca swipe'uje kandydata
          // Pobierz pełne dane kandydata
          const { data: candidateProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', item.id)
            .single();
            
          if (candidateProfile) {
            fullMatchName = candidateProfile.full_name;
          }

          // Sprawdź czy kandydat polubił jakąkolwiek ofertę tego pracodawcy
          const { data: employerJobs } = await supabase.from('jobs').select('id').eq('employer_id', user.id);
          const jobIds = employerJobs?.map(j => j.id) || [];

          if (jobIds.length > 0) {
            const { data: candidateSwipe } = await supabase
              .from('swipes')
              .select('target_id')
              .eq('swiper_id', item.id)
              .in('target_id', jobIds)
              .eq('direction', 'right')
              .limit(1)
              .single();

            if (candidateSwipe) {
              isMatch = true;
              matchData = { candidate_id: item.id, employer_id: user.id, job_id: candidateSwipe.target_id };
            }
          }
        }

        if (isMatch && matchData) {
          // Zapisz Match w bazie
          const { error: matchError } = await supabase.from('matches').insert(matchData);
          if (!matchError) {
            const matchItemWithFullName = { ...item, title: fullMatchName };
            setMatchedItem(matchItemWithFullName);
            setMatchVisible(true);
          }
        }
      }
    } catch (error) {
      console.error('Error handling swipe:', error);
    }

    position.setValue({ x: 0, y: 0 });
    setIndex(prev => prev + 1);
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-120deg', '0deg', '120deg'],
    });
    return {
      ...position.getLayout(),
      transform: [{ rotate }],
    };
  };

  const renderCard = (item: CardData) => (
    <Card style={styles.card}>
      <ImageBackground
        source={{ uri: item.image }}
        style={styles.cardImage}
        blurRadius={item.isBlurred ? 40 : 0}
        imageStyle={{ 
          opacity: item.isBlurred ? 0.7 : 1,
          resizeMode: 'cover' // Zapewnia wycentrowanie i wypełnienie całej karty
        }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)', '#000']}
          locations={[0, 0.2, 0.4, 0.7, 1.0]}
          style={styles.gradient}
        >
          {/* TOP SECTION */}
          <View style={styles.topBadgesRow}>
            <View style={styles.matchBadgeModern}>
              <MaterialCommunityIcons name="map-marker" size={14} color={Colors.primary} />
              <Text style={styles.matchTextModern}>
                {item.locationName?.split(',')[0].toUpperCase() || 'LOKALIZACJA'}
              </Text>
            </View>
            
            <View style={styles.distanceBadgeModern}>
              <MaterialCommunityIcons name="map-marker-distance" size={14} color="#fff" />
              <Text style={styles.distanceTextModern}>
                {userProfile?.lat && userProfile?.lng && item.lat && item.lng 
                  ? `${calculateDistance(userProfile.lat, userProfile.lng, item.lat, item.lng)} KM STĄD` 
                  : 'W TWOJEJ OKOLICY'}
              </Text>
            </View>
          </View>
          
          {/* MIDDLE SECTION */}
          <View style={styles.middleContainerModern}>
            {item.isBlurred ? (
              <View style={styles.lockContainerModern}>
                <View style={styles.lockIconCircle}>
                  <MaterialCommunityIcons name="shield-lock" size={50} color={Colors.primary} />
                </View>
                <Text style={styles.lockText}>Profil ukryty (Blind Hiring)</Text>
                <Text style={styles.lockSubtext}>Zdjęcie zobaczysz po dopasowaniu</Text>
              </View>
            ) : (
              <View style={styles.priceCenterContainer}>
                <View style={styles.priceBadgeLarge}>
                  <Text style={styles.priceLabelLarge}>STAWKA GODZINOWA</Text>
                  <Text style={styles.priceValueLarge}>{item.price}</Text>
                </View>
              </View>
            )}
          </View>

          {/* BOTTOM SECTION */}
          <View style={styles.overlayContentModern}>
            <View style={styles.headerRowModern}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.cardTitleModern}>{item.title}</Text>
                  {item.isVerified && (
                    <MaterialCommunityIcons name="check-decagram" size={24} color={Colors.primary} />
                  )}
                </View>
                <Text style={styles.cardSubtitleModern}>{item.subtitle}</Text>
              </View>
            </View>

            <View style={styles.infoSectionModern}>
              {(item.description || item.bio) && (
                <View style={styles.descriptionBoxModern}>
                  <Text style={styles.cardDescriptionModern} numberOfLines={3}>
                    {item.description || item.bio}
                  </Text>
                </View>
              )}

              {item.type === 'candidate' && item.experienceHistory && item.experienceHistory.length > 0 && (
                <View style={styles.experienceSnippetModern}>
                  <MaterialCommunityIcons name="history" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.experienceLabelModern}>OSTATNIE DOŚWIADCZENIE:</Text>
                    <Text style={styles.experienceValueModern} numberOfLines={1}>
                      {item.experienceHistory[0].position} @ {item.experienceHistory[0].company}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.tagGridModern}>
              {item.tags.map((tag, i) => (
                <View key={i} style={styles.tagModern}>
                  <MaterialCommunityIcons name={tag.icon as any} size={14} color={Colors.primary} />
                  <Text style={styles.tagTextModern}>{tag.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Card>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadgeSmall}>
            <MaterialCommunityIcons name="briefcase-variant" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.logoTextSmall}>Fajna<Text style={{color: Colors.primary}}>Robota</Text></Text>
        </View>
        <IconButton 
          icon="filter-variant" 
          size={24} 
          onPress={() => setShowFilterDialog(true)} 
          iconColor={filters.salaryMin > 0 || filters.experience.length > 0 || filters.radius > 20 ? Colors.primary : Colors.textLight}
        />
      </View>

      <View style={styles.cardContainer}>
        {index < cards.length ? (
          <Animated.View style={[getCardStyle(), styles.cardWrapper]} {...panResponder.panHandlers}>
            {renderCard(cards[index])}
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={80} color={Colors.textLight} />
            <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
              Brak ofert spełniających Twoje kryteria
            </Text>
            <Button 
              mode="contained" 
              onPress={() => setShowFilterDialog(true)}
              style={styles.refreshBtn}
              buttonColor={Colors.primary}
            >
              Zmień filtry
            </Button>
          </View>
        )}
      </View>

      {index < cards.length && (
        <View style={styles.footer}>
          <IconButton
            icon="close"
            mode="contained"
            containerColor={Colors.error}
            iconColor="#fff"
            size={40}
            onPress={() => forceSwipe('left')}
            style={styles.actionBtn}
          />
          <IconButton
            icon="star"
            mode="contained"
            containerColor={Colors.superJob}
            iconColor="#fff"
            size={28}
            onPress={() => {}}
            style={styles.actionBtn}
          />
          <IconButton
            icon="heart"
            mode="contained"
            containerColor={Colors.primary}
            iconColor="#fff"
            size={40}
            onPress={() => forceSwipe('right')}
            style={styles.actionBtn}
          />
        </View>
      )}

      <MatchModal
        visible={matchVisible}
        onHide={() => setMatchVisible(false)}
        onSendMessage={() => {
          setMatchVisible(false);
          router.push('/(tabs)/inbox');
        }}
        userAvatar={userProfile?.avatar_url || Config.DEFAULT_CANDIDATE_PHOTO}
        targetAvatar={matchedItem?.image || ''}
        targetName={matchedItem?.title?.split(',')[0] || ''}
      />

      <Portal>
        <Dialog visible={showFilterDialog} onDismiss={handleApplyFilters} style={styles.filterDialog}>
          <Dialog.Title style={styles.filterTitle}>Filtry wyszukiwania</Dialog.Title>
          <Dialog.Content>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Sekcja Dystans */}
              <View style={styles.filterSection}>
                <View style={styles.filterLabelRow}>
                  <Text variant="titleMedium" style={styles.filterLabel}>Maksymalny dystans</Text>
                  <Text variant="titleMedium" style={styles.filterValue}>{filters.radius} km</Text>
                </View>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={5}
                  maximumValue={500}
                  step={5}
                  value={filters.radius}
                  onValueChange={(value) => setFilters(f => ({ ...f, radius: value }))}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.background}
                  thumbTintColor={Colors.primary}
                />
              </View>

              <Divider style={styles.filterDivider} />

              {/* Sekcja Wynagrodzenie */}
              <View style={styles.filterSection}>
                <View style={styles.filterLabelRow}>
                  <Text variant="titleMedium" style={styles.filterLabel}>
                    {userProfile?.role === 'candidate' ? 'Minimalna stawka (zł/h)' : 'Maksymalna stawka (zł/h)'}
                  </Text>
                  <Text variant="titleMedium" style={styles.filterValue}>
                    {userProfile?.role === 'candidate' ? filters.salaryMin : filters.salaryMax} zł
                  </Text>
                </View>
                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={userProfile?.role === 'candidate' ? 500 : 1000}
                  step={5}
                  value={userProfile?.role === 'candidate' ? filters.salaryMin : filters.salaryMax}
                  onValueChange={(value) => {
                    if (userProfile?.role === 'candidate') {
                      setFilters(f => ({ ...f, salaryMin: value }));
                    } else {
                      setFilters(f => ({ ...f, salaryMax: value }));
                    }
                  }}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.background}
                  thumbTintColor={Colors.primary}
                />
                {userProfile?.role === 'employer' && filters.salaryMax >= 1000 && (
                  <Text variant="labelSmall" style={{ textAlign: 'center', color: Colors.textLight }}>Dowolna stawka</Text>
                )}
              </View>

              {userProfile?.role === 'employer' && (
                <>
                  <Divider style={styles.filterDivider} />
                  <View style={styles.filterSection}>
                    <Text variant="titleMedium" style={[styles.filterLabel, { marginBottom: 12 }]}>Doświadczenie</Text>
                    <View style={styles.experienceChips}>
                      {['Junior', 'Mid', 'Senior'].map(exp => (
                        <Chip
                          key={exp}
                          selected={filters.experience.includes(exp)}
                          onPress={() => {
                            setFilters(f => ({
                              ...f,
                              experience: f.experience.includes(exp) 
                                ? f.experience.filter(e => e !== exp) 
                                : [...f.experience, exp]
                            }));
                          }}
                          style={[
                            styles.expChip,
                            filters.experience.includes(exp) && { backgroundColor: Colors.primary }
                          ]}
                          textStyle={[
                            styles.expChipText,
                            filters.experience.includes(exp) && { color: '#fff' }
                          ]}
                          showSelectedOverlay
                        >
                          {exp}
                        </Chip>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              onPress={() => {
                const defaultFilters = {
                  radius: 20,
                  salaryMin: 0,
                  salaryMax: 1000,
                  experience: [],
                };
                setFilters(defaultFilters);
                AsyncStorage.setItem('fajnarobota_filters', JSON.stringify(defaultFilters));
              }}
              textColor={Colors.error}
            >
              Resetuj
            </Button>
            <Button onPress={handleApplyFilters} mode="contained" buttonColor={Colors.primary}>Zastosuj</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  logo: {
    fontFamily: 'Montserrat_900Black',
    color: Colors.primary,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadgeSmall: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTextSmall: {
    fontSize: 20,
    fontFamily: 'Montserrat_900Black',
    color: '#000',
    letterSpacing: -0.4,
  },
  cardContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 80, // Dalsze obniżenie pod logo
    justifyContent: 'center',
  },
  cardWrapper: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.76, // Kolejna korekta dla zachowania miejsca na stopkę
  },
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    backgroundColor: '#000', // Czysta czerń zamiast szarego
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardImage: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 5,
  },
  matchBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 4,
  },
  matchTextModern: {
    color: Colors.primary,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 9, // Mniejsza czcionka
    letterSpacing: 1,
  },
  distanceBadgeModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 4,
  },
  distanceTextModern: {
    color: '#fff',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 9, // Mniejsza czcionka
    letterSpacing: 1,
  },
  middleContainerModern: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20, // Dodano lekki padding od górnych plakietek
  },
  priceCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBadgeLarge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  priceLabelLarge: {
    fontSize: 10,
    fontFamily: 'Montserrat_700Bold',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 6,
  },
  priceValueLarge: {
    color: '#fff',
    fontFamily: 'Montserrat_900Black',
    fontSize: 22, // Nieco mniejsza czcionka
  },
  lockContainerModern: {
    alignItems: 'center',
    gap: 20, // Większy odstęp między ikoną a tekstem
    paddingBottom: 30, // Duży odstęp pod napisem "Zdjęcie zobaczysz po dopasowaniu"
  },
  lockIconCircle: {
    width: 60, // Jeszcze mniejsza ikona, aby nie nachodziła na tekst
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lockText: {
    color: '#fff',
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 18,
    textAlign: 'center',
  },
  lockSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 20, // Dodatkowy odstęp pod napisem
  },
  overlayContentModern: {
    gap: 14,
    paddingBottom: 20, // Zwiększony padding, aby lepiej wypełnić dół
  },
  headerRowModern: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardTitleModern: {
    fontSize: 20, // Jeszcze mniejszy tytuł dla oszczędności miejsca
    fontFamily: 'Montserrat_900Black',
    color: '#fff',
    lineHeight: 24,
  },
  cardSubtitleModern: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  infoSectionModern: {
    gap: 16,
  },
  descriptionBoxModern: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  experienceSnippetModern: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', 
  },
  experienceLabelModern: {
    fontSize: 9,
    fontFamily: 'Montserrat_700Bold',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  experienceValueModern: {
    color: '#fff',
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
  },
  cardDescriptionModern: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12, // Mniejsza czcionka bio
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  tagGridModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tagModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4, // Mniejszy padding tagów
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagTextModern: {
    color: '#fff',
    fontFamily: 'Montserrat_500Medium',
    fontSize: 10, // Mniejsza czcionka tagów
  },
  tagMoreModern: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    justifyContent: 'center',
  },
  tagMoreTextModern: {
    color: Colors.primary,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
  },
  actionBtn: {
    elevation: 4,
    margin: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    gap: 20,
  },
  refreshBtn: {
    borderRadius: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterDialog: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    maxHeight: '80%',
  },
  filterTitle: {
    fontFamily: 'Montserrat_700Bold',
    textAlign: 'center',
    fontSize: 20,
  },
  filterSection: {
    paddingVertical: 10,
  },
  filterLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    color: Colors.text,
  },
  filterValue: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.primary,
  },
  filterDivider: {
    marginVertical: 10,
    backgroundColor: Colors.border,
  },
  experienceChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  expChip: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  expChipText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
  },
});
