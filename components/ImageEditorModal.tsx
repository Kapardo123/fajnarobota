import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Dimensions, Image, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { Text, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Colors } from '../constants/Colors';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');
const CROP_SIZE = width * 0.8;

interface ImageEditorModalProps {
  visible: boolean;
  imageUri: string | null;
  onSave: (uri: string) => void;
  onCancel: () => void;
}

export default function ImageEditorModal({ visible, imageUri, onSave, onCancel }: ImageEditorModalProps) {
  const [processing, setProcessing] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  
  const pan = useRef(new Animated.ValueXY()).current;
  const lastOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (w, h) => {
        setImageSize({ width: w, height: h });
        
        // Oblicz rozmiar wyświetlania w trybie "cover" dla kwadratu CROP_SIZE
        let dWidth, dHeight;
        if (w > h) {
          dHeight = CROP_SIZE;
          dWidth = (w / h) * CROP_SIZE;
        } else {
          dWidth = CROP_SIZE;
          dHeight = (h / w) * CROP_SIZE;
        }
        setDisplaySize({ width: dWidth, height: dHeight });
        
        // Zresetuj pozycję do środka
        const initialX = -(dWidth - CROP_SIZE) / 2;
        const initialY = -(dHeight - CROP_SIZE) / 2;
        pan.setValue({ x: initialX, y: initialY });
        lastOffset.current = { x: initialX, y: initialY };
      });
    }
  }, [imageUri]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gesture) => {
        const newX = lastOffset.current.x + gesture.dx;
        const newY = lastOffset.current.y + gesture.dy;
        
        // Opcjonalnie: ogranicz przesuwanie, żeby nie wyjść poza kadrowanie
        // (pozostawiam bez ograniczeń dla większej swobody, ale można dodać clamp)
        pan.setValue({ x: newX, y: newY });
      },
      onPanResponderRelease: (e, gesture) => {
        lastOffset.current.x += gesture.dx;
        lastOffset.current.y += gesture.dy;
      },
    })
  ).current;

  const handleCrop = async () => {
    if (!imageUri || !imageSize.width) return;

    try {
      setProcessing(true);
      
      const scaleFactor = imageSize.width / displaySize.width;
      
      // Obliczamy originX i originY na podstawie przesunięcia obrazu względem ramki (0,0)
      // Ramka ma rozmiar CROP_SIZE. Obraz jest przesunięty o pan.x, pan.y.
      // Więc lewy górny róg ramki znajduje się w punkcie (-pan.x, -pan.y) na obrazie.
      
      const originX = Math.max(0, (-lastOffset.current.x) * scaleFactor);
      const originY = Math.max(0, (-lastOffset.current.y) * scaleFactor);
      const cropWidth = CROP_SIZE * scaleFactor;
      const cropHeight = CROP_SIZE * scaleFactor;

      // Zabezpieczenie przed wyjściem poza wymiary zdjęcia
      const finalOriginX = Math.min(originX, imageSize.width - 10);
      const finalOriginY = Math.min(originY, imageSize.height - 10);
      const finalWidth = Math.min(cropWidth, imageSize.width - finalOriginX);
      const finalHeight = Math.min(cropHeight, imageSize.height - finalOriginY);

      const result = await manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: finalOriginX,
              originY: finalOriginY,
              width: finalWidth,
              height: finalHeight,
            },
          },
          { resize: { width: 600, height: 600 } },
        ],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      onSave(result.uri);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="close" iconColor="#fff" onPress={onCancel} disabled={processing} />
          <Text style={styles.headerTitle}>Dostosuj zdjęcie</Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.cropArea}>
            {imageUri && displaySize.width > 0 ? (
              <Animated.View
                style={[
                  {
                    width: displaySize.width,
                    height: displaySize.height,
                    transform: pan.getTranslateTransform(),
                  },
                ]}
                {...panResponder.panHandlers}
              >
                <Image 
                  source={{ uri: imageUri }} 
                  style={styles.previewImage} 
                  resizeMode="stretch" 
                />
              </Animated.View>
            ) : (
              <ActivityIndicator color={Colors.primary} />
            )}
            
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
            </View>
          </View>
          
          <Text style={styles.hint}>
            Przesuń zdjęcie, aby dopasować je do ramki.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button 
            mode="contained" 
            onPress={handleCrop} 
            loading={processing}
            disabled={processing || !imageUri}
            buttonColor={Colors.primary}
            style={styles.saveBtn}
            contentStyle={styles.btnContent}
          >
            Zastosuj i zapisz
          </Button>
          <Button 
            mode="text" 
            onPress={onCancel} 
            textColor="#fff"
            disabled={processing}
          >
            Anuluj
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cropArea: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  frame: {
    width: '90%',
    height: '90%',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 4,
    borderStyle: 'dashed',
  },
  hint: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 24,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: 30,
    gap: 12,
  },
  saveBtn: {
    borderRadius: 16,
  },
  btnContent: {
    paddingVertical: 12,
  },
});
