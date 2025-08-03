# Fusion+ Bitcoin-Ethereum Bridge Deployment Summary

## Contract Addresses

### Ethereum Contracts (Hardhat Network)
- **FusionHTLC Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **ETHHTLC Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Network**: Hardhat (Local)
- **Chain ID**: 31337
- **Deployer**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### Bitcoin Testnet HTLC
- **HTLC Address**: `2MtNby2Jpr13bfUGuvQDm1eWRoMxaEP6hgQ`
- **Redeem Script**: `632102251a6657f0c27fd13d2a1e566f17a0be921c1b1428bb7c7a402e049b2033377aada81012345678901234567890123456789012886704bd038f68b1752103fe2b1e8add3e063412bfe92adabf7af023272a1f9d00029cbdbce09f415901ecad68`
- **Network**: Bitcoin Testnet
- **RPC URL**: `https://testnet.bitcoin.com/api`
- **Recipient Public Key**: `02251a6657f0c27fd13d2a1e566f17a0be921c1b1428bb7c7a402e049b2033377a`
- **Refund Public Key**: `03fe2b1e8add3e063412bfe92adabf7af023272a1f9d00029cbdbce09f415901ec`
- **Hashlock**: `12345678901234567890123456789012`
- **Locktime**: `1754203069`

## Key Differences Between ETHHTLC and FusionHTLC

### ETHHTLC (Basic HTLC)
- Simple atomic swap functionality
- Basic `lock()`, `redeem()`, `refund()` functions
- Standard HTLC events: `Locked`, `Redeemed`, `Refunded`
- Direct peer-to-peer swaps

### FusionHTLC (Extended HTLC)
- Extends ETHHTLC with 1inch Fusion+ integration
- Additional functions: `createFusionOrder()`, `matchFusionOrder()`, `cancelFusionOrder()`
- Fusion+ specific events: `FusionOrderCreated`, `FusionOrderMatched`, `FusionOrderCancelled`
- Order matching capabilities for better liquidity
- Support for partial fills and order book functionality

## Public RPC Endpoints

### Ethereum Networks
- **Sepolia**: `https://rpc.sepolia.org`
- **Sepolia Alternative**: `https://eth-sepolia.public.blastapi.io`
- **Goerli**: `https://rpc.ankr.com/eth_goerli`
- **Mainnet**: `https://eth.llamarpc.com`
- **Mainnet Alternative**: `https://rpc.ankr.com/eth`

### Bitcoin Networks
- **Testnet**: `https://testnet.bitcoin.com/api`
- **Testnet Alternative**: `https://btc.getblock.io/testnet`
- **Mainnet**: `https://btc.getblock.io/mainnet`
- **Mainnet Alternative**: `https://bitcoin.publicnode.com`

## Environment Variables (Updated)

```bash
# Ethereum Configuration
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234

# Bitcoin Testnet Configuration
BITCOIN_TESTNET_RPC_URL=https://testnet.bitcoin.com/api
BITCOIN_TESTNET_USERNAME=
BITCOIN_TESTNET_PASSWORD=

# Contract Addresses
FUSION_HTLC_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ETH_HTLC_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
BITCOIN_HTLC_ADDRESS=2MtNby2Jpr13bfUGuvQDm1eWRoMxaEP6hgQ
BITCOIN_REDEEM_SCRIPT=632102251a6657f0c27fd13d2a1e566f17a0be921c1b1428bb7c7a402e049b2033377aada81012345678901234567890123456789012886704bd038f68b1752103fe2b1e8add3e063412bfe92adabf7af023272a1f9d00029cbdbce09f415901ecad68

# Network Configuration
NETWORK=hardhat
CHAIN_ID=31337

# Relayer Configuration
RELAYER_ENABLED=true
RELAYER_POLL_INTERVAL=30000

# Logging
LOG_LEVEL=info

# Alternative Public RPC URLs
ETHEREUM_MAINNET_RPC=https://eth.llamarpc.com
ETHEREUM_GOERLI_RPC=https://rpc.ankr.com/eth_goerli
BITCOIN_MAINNET_RPC=https://btc.getblock.io/mainnet
BITCOIN_TESTNET_RPC=https://btc.getblock.io/testnet
```

## Deployment Status

### ✅ Completed
- [x] ETHHTLC contract deployed (Hardhat)
- [x] FusionHTLC contract deployed (Hardhat)
- [x] Bitcoin testnet HTLC address generated with public RPC
- [x] Public RPC endpoints configured
- [x] Environment file updated with all addresses
- [x] Hardhat config updated with multiple networks

### ⚠️ Pending (Requires User Input)
- [ ] Sepolia deployment (requires funded private key)
- [ ] Real private keys for production use
- [ ] Contract verification on Etherscan

### 🔧 Ready for Testing
- [x] Hardhat network deployment ready
- [x] Bitcoin testnet RPC connection verified
- [x] All public RPC endpoints configured

## Next Steps

1. **For Sepolia deployment**:
   - Get Sepolia testnet ETH from a faucet
   - Replace the private key with a funded one
   - Run: `pnpm hardhat run scripts/deploy-fusion-htlc.ts --network sepolia`

2. **Test the bridge on Hardhat**:
   - Use the CLI to create test swaps
   - Verify HTLC functionality
   - Test relayer service

3. **Production deployment**:
   - Use real private keys
   - Deploy to mainnet networks
   - Verify contracts on block explorers

## Usage Examples

### Create ETH to BTC swap
```bash
pnpm cli eth2btc --amount 0.01 --recipient <btc-pubkey>
```

### Create BTC to ETH swap
```bash
pnpm cli btc2eth --amount 0.002 --recipient <eth-address>
```

### Monitor swap status
```bash
pnpm cli track --intent-id <id>
```

### Test on Hardhat network
```bash
cd eth-contracts
pnpm hardhat node
pnpm hardhat run scripts/deploy-fusion-htlc.ts --network hardhat
``` 