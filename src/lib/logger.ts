import { useState, useEffect } from 'react';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  details?: any;
}

type LogListener = (entry: LogEntry) => void;

class Logger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 100;

  info(message: string, details?: any) {
    this.addLog('info', message, details);
  }

  warn(message: string, details?: any) {
    this.addLog('warn', message, details);
  }

  error(message: string, details?: any) {
    this.addLog('error', message, details);
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
    console.log(`[${level.toUpperCase()}] ${message}`, details || '');
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

  return { logs, clearLogs: () => logger.clear() };
}
