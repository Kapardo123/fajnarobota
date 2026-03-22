import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Platform } from 'react-native';
import { Text, IconButton, Portal, Modal, Divider, Chip, Searchbar, SegmentedButtons } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/Colors';
import { useLogs, LogEntry } from '../src/lib/logger';

interface DebugPanelProps {
  visible: boolean;
  onHide: () => void;
}

export default function DebugPanel({ visible, onHide }: DebugPanelProps) {
  const { logs, clearLogs, deviceInfo } = useLogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  const copyToClipboard = async (entry: LogEntry) => {
    const text = `[${entry.level.toUpperCase()}] ${entry.timestamp}: ${entry.message}\nDetails: ${JSON.stringify(entry.details, null, 2)}`;
    await Clipboard.setStringAsync(text);
  };

  const copyAllLogs = async () => {
    const text = filteredLogs.map(e => `[${e.level.toUpperCase()}] ${e.timestamp}: ${e.message}`).join('\n');
    await Clipboard.setStringAsync(text);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (log.details && JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFilter = filter === 'all' || log.level === filter;
      return matchesSearch && matchesFilter;
    });
  }, [logs, searchQuery, filter]);

  const renderLogItem = ({ item }: { item: LogEntry }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Chip 
          compact 
          style={[
            styles.levelChip, 
            getLevelStyle(item.level)
          ]}
          textStyle={styles.chipText}
        >
          {item.level.toUpperCase()}
        </Chip>
        <Text style={styles.timestamp}>{item.timestamp}</Text>
        <IconButton 
          icon="content-copy" 
          size={16} 
          onPress={() => copyToClipboard(item)} 
          style={styles.copyBtn}
          iconColor="#888"
        />
      </View>
      <Text style={styles.message}>{item.message}</Text>
      {item.details && (
        <View style={styles.detailsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.details}>{JSON.stringify(item.details, null, 2)}</Text>
          </ScrollView>
        </View>
      )}
      <Divider style={styles.divider} />
    </View>
  );

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'error': return styles.errorChip;
      case 'warn': return styles.warnChip;
      case 'network': return styles.networkChip;
      case 'debug': return styles.debugChip;
      case 'action': return styles.actionChip;
      default: return styles.infoChip;
    }
  };

  return (
    <Portal>
      <Modal 
        visible={visible} 
        onDismiss={onHide} 
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.title}>Debug Console</Text>
            <View style={styles.headerActions}>
              <IconButton icon="cellphone-info" iconColor="#fff" onPress={() => setShowDeviceInfo(!showDeviceInfo)} />
              <IconButton icon="delete-outline" iconColor="#fff" onPress={clearLogs} />
              <IconButton icon="content-copy" iconColor="#fff" onPress={copyAllLogs} />
              <IconButton icon="close" iconColor="#fff" onPress={onHide} />
            </View>
          </View>

          {showDeviceInfo && (
            <View style={styles.deviceInfoPanel}>
              <Text style={styles.deviceInfoTitle}>Device Information</Text>
              <View style={styles.deviceInfoGrid}>
                {Object.entries(deviceInfo).map(([key, value]) => (
                  <View key={key} style={styles.deviceInfoItem}>
                    <Text style={styles.deviceInfoKey}>{key}:</Text>
                    <Text style={styles.deviceInfoValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
              <Divider style={styles.deviceDivider} />
            </View>
          )}

          <View style={styles.filterBar}>
            <Searchbar
              placeholder="Szukaj w logach..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              inputStyle={styles.searchInput}
              iconColor="#888"
              placeholderTextColor="#666"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <SegmentedButtons
                value={filter}
                onValueChange={setFilter}
                density="small"
                style={styles.segmentedButtons}
                buttons={[
                  { value: 'all', label: 'All' },
                  { value: 'action', label: 'Akcje' },
                  { value: 'error', label: 'Błędy' },
                  { value: 'network', label: 'Sieć' },
                  { value: 'debug', label: 'Debug' },
                ]}
              />
            </ScrollView>
          </View>

          <FlatList
            data={filteredLogs}
            renderItem={renderLogItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Brak logów pasujących do filtrów.</Text>
              </View>
            )}
          />

          <View style={styles.footer}>
            <Text variant="labelSmall" style={styles.footerText}>
              {filteredLogs.length} logów • Kliknij kopiuj i wklej błąd na czacie
            </Text>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 10,
    flex: 1,
  },
  container: {
    backgroundColor: '#121212',
    borderRadius: 16,
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontFamily: 'Montserrat_700Bold',
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  deviceInfoPanel: {
    padding: 12,
    backgroundColor: '#1e1e1e',
  },
  deviceInfoTitle: {
    color: Colors.primary,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  deviceInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deviceInfoItem: {
    flexDirection: 'row',
    backgroundColor: '#2d2d2d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deviceInfoKey: {
    color: '#888',
    fontSize: 10,
    marginRight: 4,
  },
  deviceInfoValue: {
    color: '#ddd',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deviceDivider: {
    marginTop: 12,
    backgroundColor: '#333',
  },
  filterBar: {
    padding: 10,
    backgroundColor: '#1e1e1e',
    gap: 10,
  },
  searchBar: {
    height: 40,
    backgroundColor: '#2d2d2d',
    borderRadius: 8,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
    color: '#fff',
    minHeight: 0,
  },
  filterScroll: {
    flexGrow: 0,
  },
  segmentedButtons: {
    height: 32,
  },
  listContent: {
    padding: 12,
  },
  logItem: {
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelChip: {
    height: 20,
    borderRadius: 4,
  },
  infoChip: { backgroundColor: '#2196F3' },
  warnChip: { backgroundColor: '#FF9800' },
  errorChip: { backgroundColor: '#F44336' },
  networkChip: { backgroundColor: '#00BCD4' },
  debugChip: { backgroundColor: '#9C27B0' },
  actionChip: { backgroundColor: '#2196F3' },
  chipText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  timestamp: {
    color: '#666',
    fontSize: 11,
    marginLeft: 8,
    fontFamily: 'Montserrat_400Regular',
  },
  copyBtn: {
    margin: 0,
    marginLeft: 'auto',
  },
  message: {
    color: '#eee',
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  detailsContainer: {
    marginTop: 6,
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  details: {
    color: '#0f0',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    marginTop: 12,
    backgroundColor: '#222',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#444',
    fontFamily: 'Montserrat_400Regular',
  },
  footer: {
    padding: 8,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    color: '#666',
    fontSize: 10,
  }
});
