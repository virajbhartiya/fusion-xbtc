// Browser-compatible Bitcoin utilities
// This file provides mock implementations for Bitcoin operations in the browser

export interface BitcoinKeyPair {
  publicKey: string;
  privateKey: string;
  address: string;
}

export interface HTLCParams {
  hashlock: string;
  recipientPubkey: string;
  refundPubkey: string;
  locktime: number;
  network: 'mainnet' | 'testnet';
}

export class BitcoinBrowserUtils {
  static generateKeyPair(): BitcoinKeyPair {
    // Mock implementation for browser
    const mockPublicKey = '02' + '0'.repeat(64);
    const mockPrivateKey = '0'.repeat(64);
    const mockAddress = 'tb1' + '0'.repeat(34);
    
    return {
      publicKey: mockPublicKey,
      privateKey: mockPrivateKey,
      address: mockAddress,
    };
  }

  static buildHTLCAddress(params: HTLCParams): string {
    // Mock HTLC address generation
    const mockAddress = '2MtNby2Jpr13bfUGuvQDm1eWRoMxaEP6hgQ';
    return mockAddress;
  }

  static createRedeemScript(params: HTLCParams): string {
    // Mock redeem script
    return '632102251a6657f0c27fd13d2a1e566f17a0be921c1b1428bb7c7a402e049b2033377aada81012345678901234567890123456789012886704bd038f68b1752103fe2b1e8add3e063412bfe92adabf7af023272a1f9d00029cbdbce09f415901ecad68';
  }

  static validateAddress(address: string): boolean {
    // Basic address validation
    return address.startsWith('tb1') || address.startsWith('bc1') || address.startsWith('2');
  }

  static generateHashlock(secret: string): string {
    // Mock hashlock generation
    return '12345678901234567890123456789012';
  }

  static createLocktime(hoursFromNow: number = 2): number {
    return Math.floor(Date.now() / 1000) + (hoursFromNow * 3600);
  }
}

// Export for use in components
export default BitcoinBrowserUtils; 