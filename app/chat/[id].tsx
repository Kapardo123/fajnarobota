import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput, IconButton, Avatar, Appbar, Card } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../src/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'file';
  file_url?: string;
  created_at: string;
  is_me: boolean;
}

export default function ChatScreen() {
  const { id: rawId, name } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (!session?.user) {
          console.log('No active session in chat');
          return;
        }
        
        setUserId(session.user.id);

        // Pobierz wiadomości
        const { data: msgs, error } = await supabase
          .from('messages')
          .select('*')
          .eq('match_id', id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (!isMounted) return;

        setMessages(msgs.map(m => ({
          ...m,
          is_me: m.sender_id === session.user.id
        })));
      } catch (error) {
        console.error('Error loading chat:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => { isMounted = false; };
  }, [id]); // Wyzwalaj TYLKO przy zmianie ID czatu

  useEffect(() => {
    if (!id || !userId) return;
    
    // Subskrypcja na nowe wiadomości - uproszczona dla lepszej niezawodności
    const channelName = `chat_${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `match_id=eq.${id}`
      }, (payload) => {
        const newMessage = payload.new as any;
        console.log('New message received via realtime:', newMessage);
        
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, {
            ...newMessage,
            is_me: newMessage.sender_id === userId
          }];
        });
      })
      .subscribe((status) => {
        console.log(`Realtime subscription status for ${channelName}:`, status);
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id, userId]);

  const sendMessage = async () => {
    if (inputText.trim() && userId && id) {
      const text = inputText.trim();
      const tempId = `temp-${Date.now()}`;
      
      // Optymistyczna aktualizacja UI
      const optimisticMessage: Message = {
        id: tempId,
        match_id: id,
        sender_id: userId,
        content: text,
        type: 'text',
        created_at: new Date().toISOString(),
        is_me: true
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      setInputText('');
      
      try {
        const { error, data } = await supabase
          .from('messages')
          .insert({
            match_id: id,
            sender_id: userId,
            content: text,
            type: 'text'
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...data, is_me: true } : m));
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setInputText(text);
        Alert.alert('Błąd', 'Nie udało się wysłać wiadomości. Sprawdź połączenie z internetem.');
      }
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('Błąd', 'Plik jest za duży. Maksymalny rozmiar to 10MB.');
        return;
      }

      uploadFile(file);
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  const uploadFile = async (file: any) => {
    if (!userId || !id) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `cv/${fileName}`;

      // Bardziej niezawodny sposób na Blob w React Native/Expo
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('cv_files')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cv_files')
        .getPublicUrl(filePath);

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          match_id: id,
          sender_id: userId,
          content: file.name,
          type: 'file',
          file_url: publicUrl
        });

      if (messageError) throw messageError;

    } catch (error: any) {
      console.error('Error uploading file:', error);
      Alert.alert('Błąd wysyłania', error.message || 'Nie udało się wysłać pliku. Upewnij się, że bucket Storage jest poprawnie skonfigurowany.');
    } finally {
      setUploading(false);
    }
  };

  const handleFilePreview = async (url: string, fileName: string) => {
    try {
      // Wykorzystujemy Google Docs Viewer API do podglądu PDF bezpośrednio w aplikacji
      // bez konieczności pobierania pliku na telefon użytkownika
      const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
      
      if (Platform.OS === 'web') {
        window.open(googleViewerUrl, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(googleViewerUrl, {
          toolbarColor: Colors.primary,
          enableBarCollapsing: true,
          showTitle: true,
          dismissButtonStyle: 'close'
        });
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      // Fallback do bezpośredniego linku jeśli Viewer zawiedzie
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch (innerError) {
        Alert.alert('Błąd', 'Nie można otworzyć podglądu pliku.');
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
        item.is_me ? styles.myMessageBubble : styles.otherMessageBubble,
        item.type === 'file' && styles.fileBubble
      ]}>
        {item.type === 'file' ? (
          <TouchableOpacity 
            style={styles.fileContainer} 
            onPress={() => item.file_url && handleFilePreview(item.file_url, item.content)}
          >
            <View style={styles.fileIconBox}>
              <MaterialCommunityIcons name="file-pdf-box" size={32} color={item.is_me ? '#fff' : Colors.primary} />
            </View>
            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, item.is_me && { color: '#fff' }]} numberOfLines={1}>
                {item.content}
              </Text>
              <Text style={[styles.fileAction, item.is_me && { color: 'rgba(255,255,255,0.7)' }]}>
                Kliknij, aby otworzyć PDF
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={[
            styles.messageText,
            item.is_me ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
        )}
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

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.uploadingText}>Wysyłanie pliku...</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={[styles.cvButton, (loading || uploading) && { opacity: 0.5 }]} 
            onPress={pickDocument}
            disabled={loading || uploading}
          >
            <Text style={styles.cvButtonText}>CV</Text>
          </TouchableOpacity>
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
            disabled={(!inputText.trim() && !uploading) || loading}
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
  fileBubble: {
    padding: 8,
    minWidth: '60%',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: Colors.text,
  },
  fileAction: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  cvButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  cvButtonText: {
    color: Colors.primary,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
  },
  uploadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    gap: 10,
  },
  uploadingText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: Colors.primary,
  },
});
