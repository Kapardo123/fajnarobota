import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Clipboard } from 'react-native';
import { Text, IconButton, Portal, Modal, Button, Divider, Chip } from 'react-native-paper';
import { Colors } from '../constants/Colors';
import { useLogs, LogEntry } from '../src/lib/logger';

interface DebugPanelProps {
  visible: boolean;
  onHide: () => void;
}

export default function DebugPanel({ visible, onHide }: DebugPanelProps) {
  const { logs, clearLogs } = useLogs();

  const copyToClipboard = (entry: LogEntry) => {
    const text = `[${entry.level.toUpperCase()}] ${entry.timestamp}: ${entry.message}\nDetails: ${JSON.stringify(entry.details, null, 2)}`;
    Clipboard.setString(text);
  };

  const copyAllLogs = () => {
    const text = logs.map(e => `[${e.level.toUpperCase()}] ${e.timestamp}: ${e.message}`).join('\n');
    Clipboard.setString(text);
  };

  const renderLogItem = ({ item }: { item: LogEntry }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Chip 
          compact 
          style={[
            styles.levelChip, 
            item.level === 'error' ? styles.errorChip : item.level === 'warn' ? styles.warnChip : styles.infoChip
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
        />
      </View>
      <Text style={styles.message}>{item.message}</Text>
      {item.details && (
        <ScrollView horizontal style={styles.detailsScroll}>
          <Text style={styles.details}>{JSON.stringify(item.details, null, 2)}</Text>
        </ScrollView>
      )}
      <Divider style={styles.divider} />
    </View>
  );

  return (
    <Portal>
      <Modal 
        visible={visible} 
        onDismiss={onHide} 
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text variant="titleLarge" style={styles.title}>Panel Debugowania</Text>
            <View style={styles.headerActions}>
              <IconButton icon="delete-outline" onPress={clearLogs} />
              <IconButton icon="content-copy" onPress={copyAllLogs} />
              <IconButton icon="close" onPress={onHide} />
            </View>
          </View>

          <FlatList
            data={logs}
            renderItem={renderLogItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Brak logów do wyświetlenia.</Text>
              </View>
            )}
          />

          <View style={styles.footer}>
            <Text variant="labelSmall" style={styles.footerText}>
              Kliknij ikonę kopiowania przy błędzie i wstaw go do czatu.
            </Text>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    flex: 1,
    justifyContent: 'flex-start',
  },
  container: {
    backgroundColor: '#1e1e1e', // Ciemne tło dla debuggera
    borderRadius: 12,
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2d2d2d',
  },
  title: {
    color: '#fff',
    fontFamily: 'Montserrat_700Bold',
  },
  headerActions: {
    flexDirection: 'row',
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
    height: 24,
    borderRadius: 4,
  },
  infoChip: { backgroundColor: '#2196F3' },
  warnChip: { backgroundColor: '#FF9800' },
  errorChip: { backgroundColor: '#F44336' },
  chipText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  timestamp: {
    color: '#888',
    fontSize: 12,
    marginLeft: 8,
    fontFamily: 'Montserrat_400Regular',
  },
  copyBtn: {
    margin: 0,
    marginLeft: 'auto',
  },
  message: {
    color: '#ddd',
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
  },
  detailsScroll: {
    marginTop: 4,
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 4,
  },
  details: {
    color: '#0f0',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    marginTop: 12,
    backgroundColor: '#333',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontFamily: 'Montserrat_400Regular',
  },
  footer: {
    padding: 12,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    textAlign: 'center',
  }
});
