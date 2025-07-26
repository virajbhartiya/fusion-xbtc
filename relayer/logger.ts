export class Logger {
  private context: string;
  private logLevel: 'debug' | 'info' | 'warn' | 'error';

  constructor(context: string, logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.context = context;
    this.logLevel = logLevel;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
    }
    
    return `${prefix} ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      const errorData = error ? {
        message: error.message,
        stack: error.stack,
        ...error
      } : undefined;
      
      console.error(this.formatMessage('error', message, errorData));
    }
  }

  // Specialized logging methods for relayer events
  logBitcoinEvent(event: any): void {
    this.info('Bitcoin event detected', {
      type: event.type,
      txHash: event.txHash,
      hashlock: event.hashlock,
      blockHeight: event.blockHeight,
    });
  }

  logEthereumEvent(event: any): void {
    this.info('Ethereum event detected', {
      type: event.type,
      txHash: event.txHash,
      hashlock: event.hashlock,
      blockNumber: event.blockNumber,
    });
  }

  logOrderUpdate(orderId: string, oldStatus: string, newStatus: string): void {
    this.info(`Order status updated`, {
      orderId,
      oldStatus,
      newStatus,
    });
  }

  logCrossChainAction(action: any): void {
    this.info('Cross-chain action triggered', {
      type: action.type,
      chain: action.chain,
      hashlock: action.hashlock,
      orderId: action.orderId,
      priority: action.priority,
    });
  }

  logTransactionBroadcast(chain: string, txHash: string, success: boolean): void {
    const level = success ? 'info' : 'error';
    const message = success ? 'Transaction broadcasted successfully' : 'Transaction broadcast failed';
    
    this[level](message, {
      chain,
      txHash,
      success,
    });
  }

  logConnectionStatus(service: string, connected: boolean, details?: any): void {
    const level = connected ? 'info' : 'warn';
    const message = connected ? 'Connected to service' : 'Disconnected from service';
    
    this[level](message, {
      service,
      connected,
      ...details,
    });
  }

  logPerformance(operation: string, duration: number, details?: any): void {
    this.debug('Performance metric', {
      operation,
      duration: `${duration}ms`,
      ...details,
    });
  }

  // Set log level dynamically
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
    this.info(`Log level changed to: ${level}`);
  }

  // Get current log level
  getLogLevel(): string {
    return this.logLevel;
  }
} 