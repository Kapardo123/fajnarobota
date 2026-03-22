import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Text, TextInput, IconButton, Avatar, Appbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../src/lib/supabase';

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_me: boolean;
}

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    initChat();
    
    // Subskrypcja na nowe wiadomości
    const subscription = supabase
      .channel(`chat:${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `match_id=eq.${id}`
      }, (payload) => {
        const newMessage = payload.new as any;
        setMessages(prev => [...prev, {
          ...newMessage,
          is_me: newMessage.sender_id === userId
        }]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id, userId]);

  const initChat = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(msgs.map(m => ({
        ...m,
        is_me: m.sender_id === user.id
      })));
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim() && userId) {
      const text = inputText.trim();
      setInputText('');
      
      try {
        const { error } = await supabase
          .from('messages')
          .insert({
            match_id: id,
            sender_id: userId,
            content: text
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error sending message:', error);
        setInputText(text); // Przywróć tekst w razie błędu
      }
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageWrapper,
      item.is_me ? styles.myMessageWrapper : styles.otherMessageWrapper
    ]}>
      <View style={[
        styles.messageBubble,
        item.is_me ? styles.myMessageBubble : styles.otherMessageBubble
      ]}>
        <Text style={[
          styles.messageText,
          item.is_me ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.content}
        </Text>
        <Text style={item.is_me ? styles.myTimestamp : styles.timestamp}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => router.back()} color={Colors.primary} />
        <Avatar.Icon size={36} icon="account" style={styles.avatar} backgroundColor={Colors.background} color={Colors.primary} />
        <Appbar.Content 
          title={Array.isArray(name) ? name[0] : (name || 'Rozmowa')} 
          titleStyle={styles.headerTitle} 
        />
      </Appbar.Header>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Napisz wiadomość..."
            value={inputText}
            onChangeText={setInputText}
            mode="flat"
            style={styles.input}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholderTextColor={Colors.textLight}
          />
          <IconButton
            icon="send"
            mode="contained"
            containerColor={Colors.primary}
            iconColor="#fff"
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  avatar: {
    marginLeft: 8,
  },
  messageList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    width: '100%',
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  otherMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.background,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 4,
    alignSelf: 'flex-end',
    fontFamily: 'Montserrat_400Regular',
  },
  myTimestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
    fontFamily: 'Montserrat_400Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    height: 45,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    marginRight: 8,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 15,
  },
});
