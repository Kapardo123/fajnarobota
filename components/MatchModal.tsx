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
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 20,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      contentTranslateY.setValue(20);
    }
  }, [visible]);

  return (
    <Portal>
      <Modal 
        visible={visible} 
        onDismiss={onHide} 
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.overlay}>
          <Animated.View 
            style={[
              styles.card, 
              { 
                opacity: opacityAnim, 
                transform: [
                  { scale: scaleAnim },
                  { translateY: contentTranslateY }
                ] 
              }
            ]}
          >
            <View style={styles.topBar}>
              <View style={styles.logoBadgeSmall}>
                <MaterialCommunityIcons name="briefcase-variant" size={14} color={Colors.primary} />
              </View>
              <Text style={styles.logoTextSmall}>Fajna<Text style={{color: Colors.primary}}>Robota</Text></Text>
            </View>

            <View style={styles.content}>
              <Text style={styles.title}>Mamy dopasowanie!</Text>
              <Text style={styles.subtitle}>
                Twoje profile z <Text style={styles.targetNameHighlight}>{targetName}</Text> wykazują wysoki poziom wzajemnego zainteresowania.
              </Text>

              <View style={styles.comparisonContainer}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: userAvatar }} style={styles.avatar} />
                  </View>
                  <Text style={styles.avatarLabel}>Ty</Text>
                </View>

                <View style={styles.connectionLine}>
                  <View style={styles.dot} />
                  <View style={styles.line} />
                  <MaterialCommunityIcons name="handshake" size={32} color={Colors.primary} />
                  <View style={styles.line} />
                  <View style={styles.dot} />
                </View>

                <View style={styles.avatarContainer}>
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: targetAvatar }} style={styles.avatar} />
                  </View>
                  <Text style={styles.avatarLabel}>{targetName}</Text>
                </View>
              </View>

              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information-outline" size={20} color={Colors.textLight} />
                <Text style={styles.infoText}>
                  Możecie teraz nawiązać kontakt bezpośredni, aby omówić szczegóły współpracy.
                </Text>
              </View>

              <View style={styles.actions}>
                <Button 
                  mode="contained" 
                  onPress={onSendMessage}
                  style={styles.primaryBtn}
                  contentStyle={styles.btnContent}
                  labelStyle={styles.btnLabel}
                  buttonColor={Colors.primary}
                >
                  Rozpocznij konwersację
                </Button>
                
                <Button 
                  mode="outlined" 
                  onPress={onHide}
                  style={styles.secondaryBtn}
                  contentStyle={styles.btnContent}
                  labelStyle={styles.secondaryBtnLabel}
                  textColor={Colors.textLight}
                >
                  Wróć do przeglądania
                </Button>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 0,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    width: width,
    height: height,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 200, 83, 0.08)',
    paddingVertical: 12,
    gap: 8,
  },
  topBarText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  logoBadgeSmall: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTextSmall: {
    fontSize: 14,
    fontFamily: 'Montserrat_900Black',
    color: '#000',
    letterSpacing: -0.2,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Montserrat_900Black',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  targetNameHighlight: {
    fontFamily: 'Montserrat_700Bold',
    color: Colors.text,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 8,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.primary,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.text,
  },
  connectionLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: Colors.textLight,
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    elevation: 0,
  },
  secondaryBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  btnContent: {
    paddingVertical: 10,
  },
  btnLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#fff',
  },
  secondaryBtnLabel: {
    fontSize: 15,
    fontFamily: 'Montserrat_700Bold',
  },
});
