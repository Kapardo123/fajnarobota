import { View, StyleSheet, Dimensions, Animated, PanResponder, ImageBackground, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Text, Button, Chip, IconButton, Portal, Dialog } from 'react-native-paper';
import { useState, useRef, useEffect } from 'react';
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
}

export default function SwipeScreen() {
  const [index, setIndex] = useState(0);
  const [matchVisible, setMatchVisible] = useState(false);
  const [matchedItem, setMatchedItem] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardData[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [showRadiusDialog, setShowRadiusDialog] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

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
            radius_km: searchRadius
          });
        
        if (jobsError) {
          logger.error('Error fetching jobs within radius', jobsError);
          throw jobsError;
        }

        logger.info(`Fetched ${jobs?.length || 0} jobs within radius ${searchRadius}km`);

        // Filtruj już swipe'owane
        if (swipedIds.length > 0) {
          jobs = jobs?.filter((j: any) => !swipedIds.includes(j.id)) || [];
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
            };
          });
          setCards(jobCards);
        } else {
          setCards([]);
          setShowRadiusDialog(true);
        }
      } else {
        // Pracodawca widzi kandydatów, których jeszcze nie ocenił
        let query = supabase
          .from('candidates')
          .select('*, profiles(full_name, avatar_url, employers(is_verified))');
        
        if (swipedIds.length > 0) {
          query = query.not('id', 'in', `(${swipedIds.join(',')})`);
        }

        const { data: candidates } = await query;
        
        if (candidates) {
          const candidateCards: CardData[] = candidates.map(cand => ({
            id: cand.id,
            type: 'candidate',
            title: `${cand.profiles?.full_name || 'Kandydat'}, ${cand.age || ''}`,
            subtitle: cand.superpower || 'Bohater',
            image: cand.profiles?.avatar_url || `https://picsum.photos/seed/${cand.id}/600/800`,
            price: `Min. ${cand.salary_expectation} zł/h`,
            tags: (cand.skills || []).map((skill: string) => ({ icon: 'star-outline', text: skill })),
            matchScore: 85 + Math.floor(Math.random() * 15),
            isBlurred: cand.blind_hiring,
            bio: cand.bio,
            experienceHistory: cand.experience_history,
          }));
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

        if (item.type === 'job') {
          // Pobierz pracodawcę tej oferty
          const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', item.id).single();
          if (job) {
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
            setMatchedItem(item);
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
        imageStyle={{ opacity: item.isBlurred ? 0.7 : 1 }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.2, 0.4, 0.6, 0.9]}
          style={styles.gradient}
        >
          {/* TOP SECTION */}
          <View style={styles.topBadgesRow}>
            {item.matchScore ? (
              <View style={styles.matchBadgeModern}>
                <MaterialCommunityIcons name="flash" size={14} color={Colors.primary} />
                <Text style={styles.matchTextModern}>{item.matchScore}% DOPASOWANIA</Text>
              </View>
            ) : <View />}
            
            <View style={styles.distanceBadgeModern}>
              <MaterialCommunityIcons name="map-marker-distance" size={14} color="#fff" />
              <Text style={styles.distanceTextModern}>W TWOJEJ OKOLICY</Text>
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
        <Text variant="headlineSmall" style={styles.logo}>FajnaRobota</Text>
        <IconButton icon="filter-variant" size={24} onPress={() => {}} />
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
              Brak ofert w Twojej okolicy ({searchRadius}km)
            </Text>
            <Button 
              mode="contained" 
              onPress={() => setShowRadiusDialog(true)}
              style={styles.refreshBtn}
              buttonColor={Colors.primary}
            >
              Zwiększ zasięg szukania
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
        <Dialog visible={showRadiusDialog} onDismiss={() => setShowRadiusDialog(false)} style={{ backgroundColor: Colors.surface }}>
          <Dialog.Title style={{ fontFamily: 'Montserrat_700Bold' }}>Zwiększ zasięg szukania</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Nie znaleźliśmy ofert w promieniu {searchRadius}km. O ile chcesz zwiększyć zasięg?</Text>
            <View style={[styles.chipContainer, { marginTop: 20 }]}>
              {[20, 50, 100, 500].map(radius => (
                <Chip 
                  key={radius} 
                  onPress={() => {
                    setSearchRadius(radius);
                    setShowRadiusDialog(false);
                    fetchData();
                  }}
                  style={{ backgroundColor: Colors.background }}
                >
                  +{radius - searchRadius > 0 ? radius - searchRadius : radius} km (Razem {radius}km)
                </Chip>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRadiusDialog(false)} textColor={Colors.textLight}>Anuluj</Button>
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
  cardContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 40, // Dodatkowy padding u góry, aby obniżyć kartę
    justifyContent: 'center',
  },
  cardWrapper: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.75, // Nieco krótsza karta, aby lepiej się centrowała
  },
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 8,
    backgroundColor: '#1a1a1a', // Ciemne tło zapobiega "białemu polu"
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardImage: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  gradient: {
    flex: 1,
    padding: 20, // Nieco mniejszy padding, aby zyskać miejsce
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
    flex: 2, // Jeszcze więcej miejsca na środek, aby wypchnąć dół niżej
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 15, // Odstęp od dołu karty
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
});
