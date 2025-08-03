// Configuration for Fusion XBTC Relayer
// Copy this file to config.ts and update with your values

export const config = {
  // Bitcoin Configuration
  bitcoin: {
    network: 'testnet' as const, // 'mainnet' | 'testnet'
    electrumHost: 'electrum.blockstream.info',
    electrumPort: 60002,
    electrumProto: 'ssl' as const, // 'ssl' | 'tcp'
    pollInterval: 30000, // 30 seconds
  },

  // Ethereum Configuration
  ethereum: {
    network: 'sepolia' as const, // 'mainnet' | 'sepolia' | 'goerli'
    rpcUrl: 'https://1rpc.io/sepolia',
    contractAddress: '0x424cB3990169EB367860F1C6702abc29C4a107e5',
    pollInterval: 15000, // 15 seconds
    privateKey: process.env.ETHEREUM_PRIVATE_KEY || '', // For executing transactions
  },

  // Order Management
  orders: {
    dataDir: './examples/swaps',
    backupInterval: 300000, // 5 minutes
  },

  // Relayer Configuration
  relayer: {
    secretKey: process.env.RELAYER_SECRET_KEY || 'default-secret-key',
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },

  // Bitcoin Wallet (for executing transactions)
  bitcoinWallet: {
    wif: process.env.BITCOIN_WIF || '',
    changeAddress: process.env.BITCOIN_CHANGE_ADDRESS || '',
  },

  // Logging
  logging: {
    level: 'info' as const, // 'debug' | 'info' | 'warn' | 'error'
  },

  // Performance
  performance: {
    maxConcurrentEvents: 10,
    eventTimeout: 30000, // 30 seconds
  },
};

// Environment-specific configurations
export const environments = {
  development: {
    ...config,
    bitcoin: {
      ...config.bitcoin,
      pollInterval: 10000, // Faster polling for development
    },
    ethereum: {
      ...config.ethereum,
      pollInterval: 5000, // Faster polling for development
    },
    logging: {
      level: 'debug' as const,
    },
  },

  production: {
    ...config,
    bitcoin: {
      ...config.bitcoin,
      network: 'mainnet' as const,
      electrumHost: 'electrum.blockstream.info',
      electrumPort: 50002,
    },
    ethereum: {
      ...config.ethereum,
      network: 'mainnet' as const,
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your-project-id',
    },
    logging: {
      level: 'info' as const,
    },
  },

  testnet: {
    ...config,
    bitcoin: {
      ...config.bitcoin,
      network: 'testnet' as const,
    },
    ethereum: {
      ...config.ethereum,
      network: 'sepolia' as const,
    },
  },
};

// Get configuration based on environment
export function getConfig(env: keyof typeof environments = 'development') {
  const base = environments[env];
  base.ethereum.privateKey = process.env.ETHEREUM_PRIVATE_KEY || '';
  return base;
} 