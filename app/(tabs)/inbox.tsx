import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, Avatar, List, Divider, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useState, useEffect } from 'react';
import { supabase } from '../../src/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Match {
  id: string;
  candidate_id: string;
  employer_id: string;
  job_id: string;
  created_at: string;
  display_name: string;
  display_image: string;
  last_message?: string;
  last_message_at?: string;
  unread?: boolean;
}

export default function InboxScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        fetchMatches(true, user.id);
      }
    };
    init();

    // Nasłuchiwanie na nowe wiadomości i zmiany w matchach
    const subscriptionName = `inbox-global-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(subscriptionName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Realtime message change:', payload.eventType);
          fetchMatches(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          console.log('Realtime match change:', payload.eventType);
          fetchMatches(false);
        }
      )
      .subscribe((status) => {
        console.log('Inbox Realtime Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches(false);
    setRefreshing(false);
  };

  const fetchMatches = async (showLoading = true, userIdOverride?: string) => {
    try {
      if (showLoading) setLoading(true);
      
      const userId = userIdOverride || currentUserId;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
      }
      
      const activeUserId = userId || (await supabase.auth.getUser()).data.user?.id;
      if (!activeUserId) return;

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', activeUserId).single();
      const isCandidate = profile?.role === 'candidate';

      // Pobierz matche
      const { data: matchesData, error } = await supabase
        .from('matches')
        .select(`
          *,
          candidate:profiles!candidate_id(full_name, avatar_url),
          employer:profiles!employer_id(full_name, avatar_url),
          job:jobs(title)
        `)
        .or(`candidate_id.eq.${activeUserId},employer_id.eq.${activeUserId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Pobierz ostatnie wiadomości dla wszystkich patchy w jednym zapytaniu
      const matchIds = matchesData.map(m => m.id);
      let messagesData: any[] = [];
      
      if (matchIds.length > 0) {
        const { data: msgs, error: msgsError } = await supabase
          .from('messages')
          .select('match_id, content, created_at, sender_id, is_read')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false });
        
        if (!msgsError) {
          messagesData = msgs;
        }
      }

      const formattedMatches: Match[] = matchesData.map(m => {
        const otherParty = isCandidate ? m.employer : m.candidate;
        const jobTitle = m.job?.title || 'Oferta';
        
        const chatMessages = messagesData.filter(msg => msg.match_id === m.id);
        const lastMsg = chatMessages.length > 0 ? chatMessages[0] : null;
        
        const hasUnread = chatMessages.some((msg: any) => 
          msg.sender_id !== activeUserId && !msg.is_read
        );

        return {
          id: m.id,
          candidate_id: m.candidate_id,
          employer_id: m.employer_id,
          job_id: m.job_id,
          created_at: m.created_at,
          display_name: otherParty?.full_name || 'Użytkownik',
          display_image: otherParty?.avatar_url || `https://picsum.photos/seed/${m.id}/100`,
          last_message: lastMsg ? lastMsg.content : (isCandidate ? `Match z ofertą: ${jobTitle}` : `Chce pracować jako: ${jobTitle}`),
          last_message_at: lastMsg ? lastMsg.created_at : m.created_at,
          unread: hasUnread
        };
      });

      setMatches(formattedMatches.sort((a, b) => {
        const timeA = new Date(a.last_message_at || a.created_at).getTime();
        const timeB = new Date(b.last_message_at || b.created_at).getTime();
        return timeB - timeA;
      }));
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderChatItem = ({ item }: { item: Match }) => (
    <TouchableOpacity 
      onPress={() => router.push({
        pathname: '/chat/[id]',
        params: { id: item.id, name: item.display_name }
      })}
    >
      <List.Item
        title={item.display_name}
        description={item.last_message}
        left={() => (
          <View>
            <Image source={{ uri: item.display_image }} style={styles.chatAvatar} />
            {item.unread && <View style={styles.unreadBadge} />}
          </View>
        )}
        right={() => (
          <View style={styles.rightContainer}>
            <Text variant="labelSmall" style={styles.timestamp}>
              {formatDistanceToNow(new Date(item.last_message_at || item.created_at), { addSuffix: true, locale: pl })}
            </Text>
          </View>
        )}
        titleStyle={[styles.chatTitle, item.unread && styles.unreadText]}
        descriptionStyle={item.unread ? styles.unreadMessage : styles.readMessage}
        style={styles.listItem}
      />
    </TouchableOpacity>
  );

  const filteredMatches = matches.filter(m => 
    m.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>Twoje Pary</Text>
      </View>

      <Searchbar
        placeholder="Szukaj par..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        iconColor={Colors.primary}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        <View style={styles.newMatchesSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Nowe Pary</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newMatchesList}>
            {matches.slice(0, 5).map(match => (
              <TouchableOpacity 
                key={match.id} 
                style={styles.newMatchItem}
                onPress={() => router.push({
                  pathname: '/chat/[id]',
                  params: { id: match.id, name: match.display_name }
                })}
              >
                <Image source={{ uri: match.display_image }} style={styles.newMatchAvatar} />
                <Text variant="labelSmall" style={styles.newMatchName} numberOfLines={1}>{match.display_name}</Text>
              </TouchableOpacity>
            ))}
            {matches.length === 0 && (
              <Text style={{ marginLeft: 20, color: Colors.textLight, fontFamily: 'Montserrat_400Regular' }}>
                Brak nowych par. Swipe'uj dalej!
              </Text>
            )}
          </ScrollView>
        </View>

        <Divider style={styles.sectionDivider} />

        <View style={styles.chatsSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Wiadomości</Text>
          <FlatList
            data={filteredMatches}
            renderItem={renderChatItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            ListEmptyComponent={() => (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: Colors.textLight, fontFamily: 'Montserrat_400Regular' }}>
                  Brak wiadomości.
                </Text>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
  },
  searchBar: {
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
    elevation: 0,
    height: 45,
  },
  searchInput: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    minHeight: 0,
  },
  newMatchesSection: {
    marginTop: 10,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    marginBottom: 15,
    fontFamily: 'Montserrat_700Bold',
    color: Colors.text,
  },
  newMatchesList: {
    paddingHorizontal: 15,
    gap: 15,
  },
  newMatchItem: {
    alignItems: 'center',
    width: 70,
  },
  newMatchAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: Colors.primary,
    marginBottom: 5,
  },
  newMatchName: {
    color: Colors.text,
    fontFamily: 'Montserrat_400Regular',
    textAlign: 'center',
  },
  sectionDivider: {
    marginVertical: 20,
    backgroundColor: Colors.background,
    height: 8,
  },
  chatsSection: {
    flex: 1,
  },
  listItem: {
    paddingHorizontal: 10,
  },
  chatAvatar: {
    width: 55,
    height: 55,
    borderRadius: 28,
  },
  chatTitle: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.text,
    fontSize: 16,
  },
  unreadText: {
    fontFamily: 'Montserrat_900Black',
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
  },
  timestamp: {
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
  },
  unreadBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  unreadMessage: {
    color: Colors.text,
    fontFamily: 'Montserrat_700Bold',
  },
  readMessage: {
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
  },
  lastMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
});
