import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { TextInput, List, Text, Divider } from 'react-native-paper';
import { Colors } from '../constants/Colors';
import { logger } from '../src/lib/logger';

interface LocationResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPickerProps {
  label: string;
  initialValue?: string;
  onLocationSelect: (location: { name: string; lat: number; lng: number }) => void;
  placeholder?: string;
  style?: any;
}

export default function LocationPicker({ 
  label, 
  initialValue = '', 
  onLocationSelect, 
  placeholder = 'Wpisz miasto...',
  style 
}: LocationPickerProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Debounce search to avoid too many API calls
  useEffect(() => {
    // Jeśli właśnie coś wybraliśmy, nie szukajmy ponownie
    if (isSelectionActive) {
      setIsSelectionActive(false);
      return;
    }

    const timer = setTimeout(() => {
      if (query.length > 2 && showResults) {
        searchLocation(query);
      } else {
        setResults([]);
        setLoading(false);
      }
    }, 400); // Nieco krótszy czas dla lepszej reakcji

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, showResults]);

  const searchLocation = async (text: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      // Czyścimy wyniki przy starcie nowego wyszukiwania, aby uniknąć dublowania w UI
      setResults([]);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=pl&addressdetails=1&limit=15&featuretype=settlement`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'FajnaRobotaApp/1.0'
          }
        }
      );
      const data = await response.json();
      
      if (!controller.signal.aborted) {
        // Bardzo restrykcyjna filtracja:
        // 1. Tylko obiekty będące faktycznymi miejscowościami (city, town, village, hamlet)
        // 2. Pomijamy powiaty, gminy i inne twory administracyjne
        const settlementTypes = ['city', 'town', 'village', 'hamlet', 'suburb'];
        
        const seenNames = new Set();
        const uniqueData = data.filter((item: any) => {
          // Sprawdzamy typ obiektu w addressdetails lub type
          const type = item.type;
          const address = item.address || {};
          
          // Kluczowe sprawdzenie: czy to jest miejscowość, a nie gmina/powiat
          const isSettlement = settlementTypes.includes(type) || 
                               address.city || address.town || address.village || address.hamlet;
          
          // Odrzucamy jeśli to jawnie administracja (gmina/powiat)
          const isAdministrative = type === 'administrative' || address.county || address.municipality === item.display_name.split(',')[0].trim();

          if (!isSettlement) return false;

          // Budujemy czytelną nazwę: "Miejscowość, Województwo"
          const name = address.city || address.town || address.village || address.hamlet || address.suburb || item.display_name.split(',')[0].trim();
          const state = address.state ? `, ${address.state.replace('województwo ', '')}` : '';
          const cleanName = `${name}${state}`.toLowerCase();

          if (seenNames.has(cleanName)) return false;
          seenNames.add(cleanName);
          
          // Aktualizujemy display_name dla UI
          item.display_name = `${name}${state}`;
          return true;
        }).slice(0, 5);
        
        setResults(uniqueData);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      logger.error('Location search error', error);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleSelect = (item: LocationResult) => {
    setIsSelectionActive(true);
    const displayName = item.display_name;
    setQuery(displayName);
    setShowResults(false);
    setResults([]);
    onLocationSelect({
      name: displayName,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    });
  };

  const handleBlur = () => {
    // Krótkie opóźnienie, aby pozwolić na kliknięcie w element listy
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        label={label}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          if (text.length > 2) {
            setShowResults(true);
          } else {
            setShowResults(false);
            setResults([]);
          }
        }}
        onBlur={handleBlur}
        mode="outlined"
        placeholder={placeholder}
        outlineColor={Colors.border}
        activeOutlineColor={Colors.primary}
        right={loading ? <TextInput.Icon icon={() => <ActivityIndicator size="small" color={Colors.primary} />} /> : null}
        style={styles.input}
      />
      
      {showResults && (results.length > 0 || loading) && (
        <View style={styles.resultsContainer}>
          {loading && results.length === 0 ? (
            <ActivityIndicator style={{ padding: 20 }} color={Colors.primary} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <>
                  <TouchableOpacity onPress={() => handleSelect(item)}>
                    <List.Item
                      title={item.display_name}
                      titleNumberOfLines={2}
                      titleStyle={styles.resultTitle}
                      left={props => <List.Icon {...props} icon="map-marker-outline" />}
                    />
                  </TouchableOpacity>
                  <Divider />
                </>
              )}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={() => !loading && query.length > 2 ? (
                <Text style={styles.emptyText}>Nie znaleziono miejscowości.</Text>
              ) : null}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 2000, // Zwiększony zIndex dla całego kontenera
    position: 'relative',
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 250,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    zIndex: 9999, // Ekstremalnie wysoki zIndex
    overflow: 'hidden', // Aby zaokrąglenia działały z listą
  },
  list: {
    flexGrow: 0,
  },
  resultTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: Colors.textLight,
    fontFamily: 'Montserrat_400Regular',
  }
});
