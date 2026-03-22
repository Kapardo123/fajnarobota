import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Text, Avatar, List, Divider, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useState } from 'react';

const NEW_MATCHES = [
  { id: '4', name: 'Barista Pro', image: 'https://picsum.photos/seed/p1/100' },
  { id: '5', name: 'Green Cafe', image: 'https://picsum.photos/seed/p2/100' },
  { id: '6', name: 'Sushi Sun', image: 'https://picsum.photos/seed/p3/100' },
  { id: '7', name: 'Pizza Hot', image: 'https://picsum.photos/seed/p4/100' },
];

const MOCK_CHATS = [
  { id: '1', name: 'Kawa & Co.', lastMessage: 'Cześć Karolina! Kiedy masz czas na rozmowę?', timestamp: '2 min temu', unread: true, image: 'https://picsum.photos/seed/cafe1/100' },
  { id: '2', name: 'Cafe Relax', lastMessage: 'Super, zapraszamy na szkolenie.', timestamp: 'Wczoraj', unread: false, image: 'https://picsum.photos/seed/cafe2/100' },
  { id: '3', name: 'Sklep Sportowy "Sprint"', lastMessage: 'Cześć, dziękujemy za zainteresowanie.', timestamp: 'Poniedziałek', unread: false, image: 'https://picsum.photos/seed/shop1/100' },
];

export default function InboxScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const renderChatItem = ({ item }: { item: typeof MOCK_CHATS[0] }) => (
    <TouchableOpacity 
      onPress={() => router.push({
        pathname: '/chat/[id]',
        params: { id: item.id, name: item.name }
      })}
    >
      <List.Item
        title={item.name}
        description={item.lastMessage}
        left={() => (
          <Image source={{ uri: item.image }} style={styles.chatAvatar} />
        )}
        right={() => (
          <View style={styles.rightContainer}>
            <Text variant="labelSmall" style={styles.timestamp}>{item.timestamp}</Text>
            {item.unread && <View style={styles.unreadBadge} />}
          </View>
        )}
        titleStyle={[styles.chatTitle, item.unread && styles.unreadText]}
        descriptionStyle={item.unread ? styles.unreadMessage : styles.readMessage}
        style={styles.listItem}
      />
    </TouchableOpacity>
  );

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
            {NEW_MATCHES.map(match => (
              <TouchableOpacity key={match.id} style={styles.newMatchItem}>
                <Image source={{ uri: match.image }} style={styles.newMatchAvatar} />
                <Text variant="labelSmall" style={styles.newMatchName} numberOfLines={1}>{match.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Divider style={styles.sectionDivider} />

        <View style={styles.chatsSection}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Wiadomości</Text>
          <FlatList
            data={MOCK_CHATS}
            renderItem={renderChatItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
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
