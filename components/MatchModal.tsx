import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { Text, Button, Portal, Modal } from 'react-native-paper';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

interface MatchModalProps {
  visible: boolean;
  onHide: () => void;
  onSendMessage: () => void;
  userAvatar: string;
  targetAvatar: string;
  targetName: string;
}

export default function MatchModal({ 
  visible, 
  onHide, 
  onSendMessage, 
  userAvatar, 
  targetAvatar, 
  targetName 
}: MatchModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const leftAvatarAnim = useRef(new Animated.Value(-100)).current;
  const rightAvatarAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(leftAvatarAnim, {
          toValue: 0,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(rightAvatarAnim, {
          toValue: 0,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      leftAvatarAnim.setValue(-100);
      rightAvatarAnim.setValue(100);
    }
  }, [visible]);

  return (
    <Portal>
      <Modal 
        visible={visible} 
        onDismiss={onHide} 
        contentContainerStyle={styles.modalContainer}
      >
        <LinearGradient
          colors={[Colors.primary, '#00C853', '#1B5E20']}
          style={styles.gradient}
        >
          <Animated.View style={[styles.content, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
            <MaterialCommunityIcons name="heart-flash" size={80} color="#fff" style={styles.mainIcon} />
            
            <Text style={styles.title}>TO JEST MATCH!</Text>
            <Text style={styles.subtitle}>Ty i {targetName} polubiliście się nawzajem!</Text>

            <View style={styles.avatarsContainer}>
              <Animated.View style={[styles.avatarWrapper, { transform: [{ translateX: leftAvatarAnim }] }]}>
                <Image source={{ uri: userAvatar }} style={styles.avatar} />
              </Animated.View>
              
              <View style={styles.heartWrapper}>
                <MaterialCommunityIcons name="heart" size={40} color="#fff" />
              </View>

              <Animated.View style={[styles.avatarWrapper, { transform: [{ translateX: rightAvatarAnim }] }]}>
                <Image source={{ uri: targetAvatar }} style={styles.avatar} />
              </Animated.View>
            </View>

            <View style={styles.actions}>
              <Button 
                mode="contained" 
                onPress={onSendMessage}
                style={styles.primaryBtn}
                contentStyle={styles.btnContent}
                labelStyle={styles.btnLabel}
                buttonColor="#fff"
                textColor={Colors.primary}
              >
                Napisz wiadomość
              </Button>
              
              <TouchableOpacity onPress={onHide} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Szukaj dalej</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </LinearGradient>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 0,
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    padding: 30,
  },
  mainIcon: {
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  title: {
    fontSize: 42,
    fontFamily: 'Montserrat_900Black',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_400Regular',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 50,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  heartWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    marginHorizontal: -20,
    borderWidth: 4,
    borderColor: '#fff',
  },
  actions: {
    width: '100%',
    gap: 20,
  },
  primaryBtn: {
    borderRadius: 20,
    elevation: 5,
  },
  btnContent: {
    paddingVertical: 12,
  },
  btnLabel: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    textDecorationLine: 'underline',
  },
});
