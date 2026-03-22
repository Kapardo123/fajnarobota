import { View, StyleSheet, Dimensions, Animated, PanResponder, ImageBackground, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Text, Button, Chip, IconButton, Portal, Dialog, Modal } from 'react-native-paper';
import { useState, useRef, useEffect } from 'react';
import { Colors } from '../../constants/Colors';
import { Config } from '../../constants/Config';
import { supabase } from '../../src/lib/supabase';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

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
}

export default function SwipeScreen() {
  const [index, setIndex] = useState(0);
  const [matchVisible, setMatchVisible] = useState(false);
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
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setUserProfile(profile);

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
        
        if (jobsError) throw jobsError;

        // Filtruj już swipe'owane
        if (swipedIds.length > 0) {
          jobs = jobs?.filter((j: any) => !swipedIds.includes(j.id)) || [];
        }
        
        if (jobs && jobs.length > 0) {
          // Pobierz nazwy firm i logo dla tych ofert
          const employerIds = [...new Set(jobs.map((j: any) => j.employer_id))];
          const { data: employers } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
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
              tags: [
                { icon: 'map-marker', text: job.location_name || 'Lokalizacja' },
                { icon: 'flash', text: 'Od zaraz' },
              ],
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
          .select('*, profiles(full_name, avatar_url)');
        
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
          }));
          setCards(candidateCards);
        }
      }
    } catch (error) {
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
        blurRadius={item.isBlurred ? 20 : 0}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.2)', 'transparent', 'rgba(255,255,255,0.95)']}
          locations={[0, 0.5, 0.8]}
          style={styles.gradient}
        >
          {item.matchScore && (
            <View style={styles.matchBadge}>
              <Text style={styles.matchText}>🔥 {item.matchScore}% Match</Text>
            </View>
          )}
          
          {item.isBlurred && (
            <View style={styles.lockContainer}>
              <MaterialCommunityIcons name="lock" size={40} color={Colors.text} />
            </View>
          )}

          <View style={styles.overlayContent}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>{item.price}</Text>
            </View>

            <View style={styles.tagRow}>
              {item.tags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <MaterialCommunityIcons name={tag.icon as any} size={16} color={Colors.textLight} />
                  <Text style={styles.tagText}>{tag.text}</Text>
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

      <Portal>
        <Modal visible={matchVisible} onDismiss={() => setMatchVisible(false)} contentContainerStyle={styles.matchModal}>
          <View style={styles.matchContainer}>
            <Text style={styles.matchTitle}>FAJNA ROBOTA! 🤩</Text>
            
            <View style={styles.matchAvatars}>
              {index < cards.length && (
                <>
                  <View style={styles.avatarCircle}>
                    <Image source={{ uri: userProfile?.avatar_url }} style={styles.avatarImg} />
                  </View>
                  <View style={[styles.avatarCircle, styles.avatarOverlap]}>
                    <Image source={{ uri: cards[index].image }} style={styles.avatarImg} />
                  </View>
                </>
              )}
            </View>

            <Button
              mode="contained"
              onPress={() => {
                setMatchVisible(false);
                router.push('/(tabs)/inbox');
              }}
              style={styles.matchActionBtn}
              buttonColor={Colors.primary}
            >
              Napisz pierwszą wiadomość
            </Button>
            <Button onPress={() => setMatchVisible(false)} textColor="#fff">
              Swipe'uj dalej
            </Button>
          </View>
        </Modal>
      </Portal>

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
    justifyContent: 'center',
  },
  cardWrapper: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.7,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 4,
  },
  cardImage: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  matchBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  matchText: {
    color: Colors.primary,
    fontFamily: 'Montserrat_700Bold',
  },
  lockContainer: {
    position: 'absolute',
    top: '40%',
    left: '45%',
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 10,
    borderRadius: 30,
  },
  overlayContent: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 32,
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    marginBottom: 8,
  },
  priceBadge: {
    backgroundColor: Colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  priceText: {
    color: '#fff',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagText: {
    color: Colors.text,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingBottom: 40,
  },
  actionBtn: {
    elevation: 4,
    margin: 0,
  },
  emptyState: {
    alignItems: 'center',
    gap: 20,
  },
  refreshBtn: {
    borderRadius: 12,
  },
  matchModal: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    margin: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchContainer: {
    alignItems: 'center',
    width: '100%',
    padding: 40,
  },
  matchTitle: {
    fontSize: 36,
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 40,
  },
  matchAvatars: {
    flexDirection: 'row',
    marginBottom: 60,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  avatarOverlap: {
    marginLeft: -40,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  matchActionBtn: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
