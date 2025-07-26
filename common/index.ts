import { z } from 'zod';

// Common types for the Fusion XBTC project
export interface HTLCConfig {
  hashlock: string;
  timelock: number;
  recipient: string;
  refundAddress: string;
  amount: string;
  network: 'mainnet' | 'testnet';
  chain: 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch' | 'ethereum';
}

export interface SwapStatus {
  intentId: string;
  status: 'pending' | 'locked' | 'redeemed' | 'refunded' | 'expired';
  secret?: string;
  hashlock: string;
  ethTx?: string;
  btcTx?: string;
  timestamp: number;
  amount: string;
  recipient: string;
  refundAddress: string;
}

export interface OrderData {
  orderId: string;
  amount: number;
  remainingAmount: number;
  minFillAmount: number;
  maxFillAmount: number;
  recipientAddress: string;
  refundAddress: string;
  secret: string;
  hashlock: string;
  locktime: number;
  network: string;
  chain: string;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  fills: Array<{
    fillId: string;
    amount: number;
    txid: string;
    timestamp: number;
    htlcAddress: string;
    redeemScript: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

// Zod schemas for validation
export const HTLCConfigSchema = z.object({
  hashlock: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  timelock: z.number().positive(),
  recipient: z.string().min(1),
  refundAddress: z.string().min(1),
  amount: z.string().min(1),
  network: z.enum(['mainnet', 'testnet']),
  chain: z.enum(['bitcoin', 'litecoin', 'dogecoin', 'bch', 'ethereum']),
});

export const SwapStatusSchema = z.object({
  intentId: z.string(),
  status: z.enum(['pending', 'locked', 'redeemed', 'refunded', 'expired']),
  secret: z.string().optional(),
  hashlock: z.string(),
  ethTx: z.string().optional(),
  btcTx: z.string().optional(),
  timestamp: z.number(),
  amount: z.string(),
  recipient: z.string(),
  refundAddress: z.string(),
});

export const OrderDataSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  remainingAmount: z.number().nonnegative(),
  minFillAmount: z.number().positive(),
  maxFillAmount: z.number().positive(),
  recipientAddress: z.string(),
  refundAddress: z.string(),
  secret: z.string().regex(/^[a-fA-F0-9]{64}$/),
  hashlock: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  locktime: z.number().positive(),
  network: z.string(),
  chain: z.string(),
  status: z.enum(['open', 'partial', 'filled', 'cancelled']),
  fills: z.array(z.object({
    fillId: z.string(),
    amount: z.number().positive(),
    txid: z.string(),
    timestamp: z.number(),
    htlcAddress: z.string(),
    redeemScript: z.string(),
  })),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// Utility functions
export function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function generateHashlock(secret: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    return '0x' + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  });
}

export function validateAddress(address: string, chain: string): boolean {
  // Basic validation - in production, use proper address validation libraries
  switch (chain) {
    case 'bitcoin':
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[a-z0-9]{39,59}$/.test(address);
    case 'ethereum':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    default:
      return address.length > 0;
  }
}

export function formatAmount(amount: string, chain: string): string {
  const num = parseFloat(amount);
  switch (chain) {
    case 'bitcoin':
    case 'litecoin':
    case 'dogecoin':
    case 'bch':
      return `${num} ${chain.toUpperCase()}`;
    case 'ethereum':
      return `${num} ETH`;
    default:
      return amount;
  }
} 