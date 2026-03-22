import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Dimensions, Image, TouchableOpacity } from 'react-native';
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

  useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (w, h) => {
        setImageSize({ width: w, height: h });
      });
    }
  }, [imageUri]);

  const handleCrop = async () => {
    if (!imageUri) return;

    try {
      setProcessing(true);
      
      // Obliczamy wymiary dla kwadratowego kadrowania (centrowanie)
      const minDimension = Math.min(imageSize.width, imageSize.height);
      const originX = (imageSize.width - minDimension) / 2;
      const originY = (imageSize.height - minDimension) / 2;

      const result = await manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX,
              originY,
              width: minDimension,
              height: minDimension,
            },
          },
          { resize: { width: 600, height: 600 } }, // Optymalizacja rozmiaru
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
          <Text style={styles.headerTitle}>Wyśrodkuj zdjęcie</Text>
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.cropArea}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            ) : null}
            <View style={styles.overlay}>
              <View style={styles.frame} />
            </View>
          </View>
          
          <Text style={styles.hint}>
            Zdjęcie zostanie automatycznie wykadrowane do kwadratu i wyśrodkowane.
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
