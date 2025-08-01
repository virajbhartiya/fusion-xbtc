declare module 'electrum-client' {
  export default class ElectrumClient {
    constructor(port: number, host: string, protocol?: string);
    connect(): Promise<void>;
    close(): Promise<void>;
    blockchainTransaction_broadcast(txHex: string): Promise<string>;
  }
} 