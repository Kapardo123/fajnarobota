import { Tabs, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function TabsLayout() {
  // Sesja jest teraz obsługiwana globalnie w app/_layout.tsx
  // Nie potrzebujemy tu checkSession()
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
