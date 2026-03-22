import { View, StyleSheet, Dimensions, Animated, PanResponder, ImageBackground, Modal, Image, ActivityIndicator } from 'react-native';
import { Card, Text, Button, Chip, IconButton, Portal } from 'react-native-paper';
import { useState, useRef, useEffect } from 'react';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

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
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'candidate') {
        // Kandydat widzi oferty pracy
        const { data: jobs } = await supabase
          .from('jobs')
          .select('*, employers(company_name)');
        
        if (jobs) {
          const jobCards: CardData[] = jobs.map(job => ({
            id: job.id,
            type: 'job',
            title: job.title,
            subtitle: job.employers?.company_name || 'Firma',
            image: `https://picsum.photos/seed/${job.id}/600/800`,
            price: job.salary_range || 'Do uzgodnienia',
            tags: [
              { icon: 'map-marker', text: job.location || 'Warszawa' },
              { icon: 'flash', text: 'Od zaraz' },
            ],
          }));
          setCards(jobCards);
        }
      } else {
        // Pracodawca widzi kandydatów
        const { data: candidates } = await supabase
          .from('candidates')
          .select('*, profiles(full_name, avatar_url)');
        
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

  const onSwipeComplete = (direction: 'right' | 'left') => {
    if (direction === 'right') {
      setMatchVisible(true);
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
          colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        >
          {item.matchScore && (
            <View style={styles.matchBadge}>
              <Text style={styles.matchText}>🔥 {item.matchScore}% Match</Text>
            </View>
          )}
          
          {item.isBlurred && (
            <View style={styles.lockContainer}>
              <MaterialCommunityIcons name="lock" size={40} color="#fff" />
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
                  <MaterialCommunityIcons name={tag.icon as any} size={16} color="#fff" />
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
            <Text variant="headlineSmall">To wszystko na dziś! 🎉</Text>
            <Button mode="contained" onPress={() => { setIndex(0); fetchData(); }} style={styles.refreshBtn} buttonColor={Colors.primary}>
              Odśwież
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
              {cards.length >= 2 && (
                <>
                  <View style={styles.avatarCircle}>
                    <Image source={{ uri: cards[0].image }} style={styles.avatarImg} />
                  </View>
                  <View style={[styles.avatarCircle, styles.avatarOverlap]}>
                    <Image source={{ uri: cards[1].image }} style={styles.avatarImg} />
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
    color: '#fff',
    fontFamily: 'Montserrat_700Bold',
  },
  lockContainer: {
    position: 'absolute',
    top: '40%',
    left: '45%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 10,
    borderRadius: 30,
  },
  overlayContent: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 32,
    fontFamily: 'Montserrat_900Black',
    color: '#fff',
  },
  cardSubtitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255,255,255,0.9)',
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
    color: '#fff',
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
    backgroundColor: 'rgba(0,0,0,0.9)',
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
    color: '#fff',
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
});
