import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Text, Avatar, List, Divider, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useState, useEffect } from 'react';
import { supabase } from '../../src/lib/supabase';

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
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isCandidate = profile?.role === 'candidate';

      // Pobierz matche z danymi drugiej strony
      let query = supabase
        .from('matches')
        .select(`
          *,
          candidate:profiles!candidate_id(full_name, avatar_url),
          employer:profiles!employer_id(full_name, avatar_url),
          job:jobs(title, employers(company_name))
        `)
        .or(`candidate_id.eq.${user.id},employer_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const { data: matchesData, error } = await query;

      if (error) throw error;

      const formattedMatches: Match[] = matchesData.map(m => {
        const otherParty = isCandidate ? m.employer : m.candidate;
        const jobTitle = m.job?.title || 'Oferta';
        const companyName = m.job?.employers?.company_name || otherParty?.full_name;

        return {
          id: m.id,
          candidate_id: m.candidate_id,
          employer_id: m.employer_id,
          job_id: m.job_id,
          created_at: m.created_at,
          display_name: isCandidate ? companyName : otherParty?.full_name || 'Kandydat',
          display_image: otherParty?.avatar_url || `https://picsum.photos/seed/${m.id}/100`,
          last_message: isCandidate ? `Match z ofertą: ${jobTitle}` : `Chce pracować jako: ${jobTitle}`,
          last_message_at: m.created_at,
          unread: false
        };
      });

      setMatches(formattedMatches);
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
          <Image source={{ uri: item.display_image }} style={styles.chatAvatar} />
        )}
        right={() => (
          <View style={styles.rightContainer}>
            <Text variant="labelSmall" style={styles.timestamp}>
              {new Date(item.last_message_at || item.created_at).toLocaleDateString()}
            </Text>
            {item.unread && <View style={styles.unreadBadge} />}
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

      <ScrollView showsVerticalScrollIndicator={false}>
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  unreadMessage: {
    color: Colors.text,
    fontFamily: 'Montserrat_700Bold',
  },
  readMessage: {
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
  },
});
