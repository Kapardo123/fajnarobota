import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'network' | 'debug' | 'action';
  message: string;
  details?: any;
}

type LogListener = (entry: LogEntry) => void;

class Logger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 200;

  info(message: string, details?: any) {
    this.addLog('info', message, details);
  }

  warn(message: string, details?: any) {
    this.addLog('warn', message, details);
  }

  error(message: string, details?: any) {
    this.addLog('error', message, details);
  }

  network(message: string, details?: any) {
    this.addLog('network', message, details);
  }

  debug(message: string, details?: any) {
    this.addLog('debug', message, details);
  }

  action(buttonName: string, details?: any) {
    this.addLog('action', `Kliknięto przycisk: ${buttonName}`, details);
  }

  private addLog(level: LogEntry['level'], message: string, details?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      details
    };

    this.logs = [entry, ...this.logs].slice(0, this.maxLogs);
    
    // Konsola w trybie deweloperskim
    if (__DEV__) {
      const color = {
        info: '\x1b[32m', // green
        warn: '\x1b[33m', // yellow
        error: '\x1b[31m', // red
        network: '\x1b[36m', // cyan
        debug: '\x1b[35m', // magenta
        action: '\x1b[34m'  // blue
      }[level];
      console.log(`${color}[${level.toUpperCase()}] ${message}\x1b[0m`, details || '');
    }
    
    this.notify(entry);
  }

  private notify(entry: LogEntry) {
    this.listeners.forEach(listener => listener(entry));
  }

  subscribe(listener: LogListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getLogs() {
    return this.logs;
  }

  getDeviceInfo() {
    return {
      brand: Device.brand,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      platform: Platform.OS,
      isDevice: Device.isDevice,
    };
  }

  clear() {
    this.logs = [];
    this.notify({ id: 'clear', timestamp: '', level: 'info', message: 'Logs cleared' });
  }
}

export const logger = new Logger();

// Hook do używania logów w komponentach
export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());

  useEffect(() => {
    return logger.subscribe(() => {
      setLogs([...logger.getLogs()]);
    });
  }, []);

  return { 
    logs, 
    clearLogs: () => logger.clear(),
    deviceInfo: logger.getDeviceInfo()
  };
}
