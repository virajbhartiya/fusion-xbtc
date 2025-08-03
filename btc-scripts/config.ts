export interface BitcoinConfig {
  rpcUrl: string;
  username?: string;
  password?: string;
  network: 'mainnet' | 'testnet';
}

export const bitcoinConfigs: Record<string, BitcoinConfig> = {
  testnet: {
    rpcUrl: 'https://testnet.bitcoin.com/api',
    network: 'testnet',
  },
  testnet_alternative: {
    rpcUrl: 'https://btc.getblock.io/testnet',
    network: 'testnet',
  },
  mainnet: {
    rpcUrl: 'https://btc.getblock.io/mainnet',
    network: 'mainnet',
  },
  mainnet_alternative: {
    rpcUrl: 'https://bitcoin.publicnode.com',
    network: 'mainnet',
  },
};

export const getBitcoinConfig = (network: 'mainnet' | 'testnet' = 'testnet'): BitcoinConfig => {
  const configs = Object.values(bitcoinConfigs).filter(config => config.network === network);
  return configs[0] || bitcoinConfigs.testnet;
};

export const ethereumConfigs = {
  sepolia: {
    rpcUrl: 'https://rpc.sepolia.org',
    chainId: 11155111,
  },
  goerli: {
    rpcUrl: 'https://rpc.ankr.com/eth_goerli',
    chainId: 5,
  },
  mainnet: {
    rpcUrl: 'https://eth.llamarpc.com',
    chainId: 1,
  },
  mainnet_alternative: {
    rpcUrl: 'https://rpc.ankr.com/eth',
    chainId: 1,
  },
}; 