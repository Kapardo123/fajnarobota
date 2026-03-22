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

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2 && showResults) {
        searchLocation(query);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, showResults]);

  const searchLocation = async (text: string) => {
    try {
      setLoading(true);
      // Używamy Nominatim (OpenStreetMap) API - darmowe, nie wymaga klucza
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=pl&addressdetails=1&limit=5`,
        {
          headers: {
            'User-Agent': 'FajnaRobotaApp/1.0'
          }
        }
      );
      const data = await response.json();
      setResults(data);
    } catch (error) {
      logger.error('Location search error', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: LocationResult) => {
    setQuery(item.display_name);
    setShowResults(false);
    setResults([]);
    onLocationSelect({
      name: item.display_name,
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
    borderRadius: 8,
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
    zIndex: 3000, // Jeszcze wyższy zIndex dla wyników
  },
  list: {
    flexGrow: 0,
  },
  resultTitle: {
    fontSize: 14,
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: Colors.textLight,
    fontFamily: 'Montserrat_400Regular',
  }
});
