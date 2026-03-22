import { Tabs, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function TabsLayout() {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        fetchUnreadCount(user.id);
      }
    };
    getUserId();

    // Subskrypcja na zmiany w wiadomościach
    const channel = supabase
      .channel('global-unread-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          if (userId) fetchUnreadCount(userId);
          else getUserId(); // Ponów próbę pobrania ID i licznika
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchUnreadCount = async (uid: string) => {
    try {
      // Pobierz IDs wszystkich matchy tego użytkownika
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id')
        .or(`candidate_id.eq.${uid},employer_id.eq.${uid}`);

      if (matchesError) throw matchesError;
      if (!matches || matches.length === 0) {
        setUnreadCount(0);
        return;
      }

      const matchIds = matches.map(m => m.id);

      // Policz nieprzeczytane wiadomości TYLKO w tych matchach
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('match_id', matchIds)
        .eq('is_read', false)
        .neq('sender_id', uid);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: Colors.primary,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerTintColor: Colors.primary,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Szukaj',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="gesture-swipe-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Wiadomości',
          tabBarBadge: unreadCount && unreadCount > 0 ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#4CAF50', // Zielona kropka
            minWidth: 12,
            height: 12,
            borderRadius: 6,
            marginTop: 4,
          },
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
