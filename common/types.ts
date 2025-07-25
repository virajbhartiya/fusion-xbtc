export type HTLCParams = {
  hashlock: string;
  timelock: number;
  recipient: string;
  sender: string;
  amount: string;
};

export type SwapDirection = 'eth2btc' | 'btc2eth';

export type SwapState = 'pending' | 'locked' | 'redeemed' | 'refunded';
