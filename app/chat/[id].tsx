import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
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
  is_read: boolean;
}

interface JobInfo {
  title: string;
  salary_range: string;
  location_name: string;
  description: string;
  skills: string[];
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
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [jobModalVisible, setJobInfoVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const markMessagesAsRead = async (matchId: string, currentUserId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('match_id', matchId)
        .neq('sender_id', currentUserId)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

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

        // Pobierz wiadomości oraz informacje o ofercie
        const [msgsRes, matchRes] = await Promise.all([
          supabase
            .from('messages')
            .select('*')
            .eq('match_id', id)
            .order('created_at', { ascending: true }),
          supabase
            .from('matches')
            .select('job:jobs(title, salary_range, location_name, description, required_skills)')
            .eq('id', id)
            .single()
        ]);

        if (msgsRes.error) throw msgsRes.error;
        if (matchRes.error) console.error('Error fetching job info:', matchRes.error);

        if (!isMounted) return;

        const formattedMsgs = msgsRes.data.map(m => ({
          ...m,
          is_me: m.sender_id === session.user.id
        }));
        setMessages(formattedMsgs);

        if (matchRes.data?.job) {
          const job = matchRes.data.job as any;
          setJobInfo({
            title: job.title,
            salary_range: job.salary_range,
            location_name: job.location_name,
            description: job.description,
            skills: job.required_skills || []
          });
        }

        // Oznacz jako przeczytane
        if (formattedMsgs.some(m => !m.is_me && !m.is_read)) {
          markMessagesAsRead(id, session.user.id);
        }
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
    
    // Subskrypcja na wszystkie zmiany w wiadomościach dla tego czatu
    const subscriptionName = `chat-room-${id}-${Math.random().toString(36).substring(7)}`;
    const subscription = supabase
      .channel(subscriptionName)
      .on('postgres_changes', { 
        event: '*', // Słuchaj na INSERT, UPDATE, DELETE
        schema: 'public', 
        table: 'messages',
        filter: `match_id=eq.${id}`
      }, (payload) => {
        console.log('Realtime chat event:', payload.eventType, payload.new);
        
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as any;
          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            
            if (newMessage.sender_id !== userId) {
              markMessagesAsRead(id, userId);
            }

            return [...prev, {
              ...newMessage,
              is_me: newMessage.sender_id === userId
            }];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedMessage = payload.new as any;
          setMessages(prev => prev.map(m => 
            m.id === updatedMessage.id ? { ...m, ...updatedMessage, is_me: updatedMessage.sender_id === userId } : m
          ));
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id === payload.old.id));
        }
      })
      .subscribe((status) => {
        console.log(`Chat room realtime status (${subscriptionName}):`, status);
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id, userId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !id) return;
    
    let activeUserId = userId;
    if (!activeUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Błąd', 'Musisz być zalogowany, aby wysłać wiadomość.');
        return;
      }
      activeUserId = user.id;
      setUserId(user.id);
    }

    const text = inputText.trim();
    setInputText('');

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      match_id: id,
      sender_id: activeUserId,
      content: text,
      type: 'text',
      created_at: new Date().toISOString(),
      is_me: true,
      is_read: false
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          match_id: id,
          sender_id: activeUserId,
          content: text,
          type: 'text'
          // is_read zostanie ustawione na false domyślnie w bazie
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...data, is_me: true } : m));
      }
    } catch (error: any) {
      console.error('Detailed Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(text);
      Alert.alert('Błąd wysyłania', `Kod: ${error.code || 'unknown'}\n${error.message}`);
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
          subtitle={jobInfo ? `Dotyczy: ${jobInfo.title}` : ''}
          subtitleStyle={styles.headerSubtitle}
          onPress={() => jobInfo && setJobInfoVisible(true)}
        />
        {jobInfo && (
          <Appbar.Action 
            icon="information-outline" 
            onPress={() => setJobInfoVisible(true)} 
            color={Colors.primary} 
          />
        )}
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

      {/* Modal z parametrami stanowiska */}
      <Modal 
        visible={jobModalVisible} 
        onRequestClose={() => setJobInfoVisible(false)} 
        transparent={true} 
        animationType="slide"
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setJobInfoVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View>
                <Text variant="headlineSmall" style={styles.modalTitle}>{jobInfo?.title}</Text>
                <Text variant="labelMedium" style={{ color: Colors.primary, fontFamily: 'Montserrat_700Bold' }}>
                  {jobInfo?.salary_range}
                </Text>
              </View>
              <IconButton icon="close" onPress={() => setJobInfoVisible(false)} />
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="map-marker" size={20} color={Colors.textLight} />
                <Text style={styles.infoText}>{jobInfo?.location_name}</Text>
              </View>

              <Text style={styles.sectionLabel}>Opis stanowiska</Text>
              <Text style={styles.descriptionText}>{jobInfo?.description}</Text>

              <Text style={styles.sectionLabel}>Wymagane umiejętności</Text>
              <View style={styles.skillsContainer}>
                {jobInfo?.skills.map((skill, index) => (
                  <Card key={index} style={styles.skillChip}>
                    <Text style={styles.skillText}>{skill}</Text>
                  </Card>
                ))}
              </View>
            </ScrollView>

            <Button 
              mode="contained" 
              onPress={() => setJobInfoVisible(false)}
              style={styles.closeBtn}
              buttonColor={Colors.primary}
            >
              Zamknij
            </Button>
          </View>
        </TouchableOpacity>
      </Modal>
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
    fontSize: 16,
    color: Colors.text,
  },
  headerSubtitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    color: Colors.text,
  },
  modalScroll: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  infoText: {
    fontFamily: 'Montserrat_600SemiBold',
    color: Colors.textLight,
    fontSize: 14,
  },
  sectionLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  descriptionText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  skillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.background,
    elevation: 0,
  },
  skillText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  closeBtn: {
    borderRadius: 12,
    marginTop: 10,
  },
});
