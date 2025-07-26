# Fusion XBTC - Trustless Atomic Swaps

A complete implementation of trustless atomic swaps between Ethereum and Bitcoin/Litecoin/Dogecoin/Bitcoin Cash using Hash Time-Locked Contracts (HTLCs).

## Features

- **100% Trustless**: All swaps enforced by HTLCs on both chains
- **Multi-Chain Support**: ETH ↔ BTC/LTC/DOGE/BCH
- **Bidirectional Flows**: ETH→BTC and BTC→ETH swaps
- **Partial Fills**: Support for order splitting and partial fills
- **CLI & UI**: Both command-line and web interface
- **Relayer Service**: Automated cross-chain execution
- **Production Ready**: Complete with validation, error handling, and logging

## Architecture

```
fusion-xbtc/
├── cli/                 # Command-line interface
├── eth-contracts/       # Ethereum HTLC smart contracts
├── btc-scripts/         # Bitcoin HTLC script utilities
├── relayer/            # Cross-chain relayer service
├── frontend/           # Web UI
├── common/             # Shared types and utilities
└── examples/           # Example swaps and configurations
```

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Bitcoin testnet wallet with funds
- Ethereum testnet wallet with ETH
- Electrum server access (testnet)

### Installation

```bash
# Clone and install dependencies
git clone https://github.com/virajbhartiya/fusion-xbtc.git
cd fusion-xbtc
pnpm install

# Set up environment variables
cp relayer/env.example relayer/.env
cp frontend/env.example frontend/.env
cp eth-contracts/env.example eth-contracts/.env

# Edit the .env files with your configuration
```

### Configuration

1. **Relayer Configuration** (`relayer/.env`):
   ```bash
   ETHEREUM_PRIVATE_KEY=your-eth-private-key
   BITCOIN_WIF=your-bitcoin-wif
   BITCOIN_CHANGE_ADDRESS=your-btc-change-address
   ```

2. **Frontend Configuration** (`frontend/.env`):
   ```bash
   VITE_ETH_HTLC_ADDRESS=0x03350065C0eAa7AD4410F72806E29AFDbC64A410
   VITE_UNISAT_PUBKEY=your-unisat-public-key
   ```

3. **Contract Deployment** (`eth-contracts/.env`):
   ```bash
   SEPOLIA_RPC_URL=https://1rpc.io/sepolia
   PRIVATE_KEY=your-eth-private-key
   ```

### Running the System

```bash
# Start the relayer service
pnpm relayer

# Start the frontend (in another terminal)
pnpm frontend

# Use CLI tools
pnpm cli create-order --orderId=my-order --amount=100000 --minFillAmount=10000 --maxFillAmount=50000 --recipientAddress=tb1q... --refundAddress=tb1q...
```

## CLI Commands

### Order Management
```bash
# Create a new order
pnpm cli create-order --orderId=order-001 --amount=100000 --minFillAmount=10000 --maxFillAmount=50000 --recipientAddress=tb1q... --refundAddress=tb1q...

# List orders
pnpm cli list-orders

# Partial fill
pnpm cli partial-fill --orderId=order-001 --fillAmount=25000 --recipientPubkey=... --refundPubkey=... --locktime=3600
```

### HTLC Operations
```bash
# Lock ETH
pnpm cli eth-lock --rpc=https://1rpc.io/sepolia --contract=0x... --hashlock=0x... --timelock=3600 --recipient=0x... --amount=0.01 --senderPrivkey=0x...

# Lock BTC
pnpm cli btc-lock --hashlock=0x... --recipientPubkey=... --refundPubkey=... --locktime=3600 --amount=100000 --utxos='[...]' --changeAddress=tb1q... --feeSats=1000 --electrumHost=testnet.hsmiths.com --electrumPort=53011

# Redeem ETH
pnpm cli eth-redeem --rpc=https://1rpc.io/sepolia --contract=0x... --secret=... --senderPrivkey=0x...

# Redeem BTC
pnpm cli btc-redeem --hashlock=0x... --secret=... --utxoTxid=... --utxoVout=0 --utxoAmount=100000 --redeemPrivkey=... --htlcRecipientPubkey=... --htlcRefundPubkey=... --htlcLocktime=3600 --htlcScript=... --destAddress=tb1q... --feeSats=1000 --electrumHost=testnet.hsmiths.com --electrumPort=53011

# Refund operations
pnpm cli eth-refund --rpc=https://1rpc.io/sepolia --contract=0x... --hashlock=0x... --senderPrivkey=0x...
pnpm cli btc-refund --utxoTxid=... --utxoVout=0 --utxoAmount=100000 --refundPrivkey=... --htlcRecipientPubkey=... --htlcRefundPubkey=... --htlcLocktime=3600 --htlcScript=... --destAddress=tb1q... --feeSats=1000 --electrumHost=testnet.hsmiths.com --electrumPort=53011

# Track swap status
pnpm cli track --hashlock=0x...
```

## Web Interface

The frontend provides a user-friendly interface for:
- Connecting wallets (MetaMask, Unisat, Hiro, Xverse)
- Initiating swaps
- Monitoring swap status
- Executing HTLC operations

Access at `http://localhost:5173` after running `pnpm frontend`.

## Relayer Service

The relayer automatically:
- Monitors both chains for HTLC events
- Executes cross-chain actions
- Manages order lifecycle
- Handles partial fills
- Provides status updates

Start with `pnpm relayer` after configuring environment variables.

## Development

### Project Structure
- **CLI**: TypeScript-based command-line tools
- **Contracts**: Solidity HTLC implementation
- **Scripts**: Bitcoin HTLC script builders and parsers
- **Relayer**: Node.js service for cross-chain coordination
- **Frontend**: React + Vite web application
- **Common**: Shared types and utilities

### Testing
```bash
# Run all tests
pnpm test

# Test specific modules
pnpm --filter eth-contracts test
pnpm --filter relayer test
```

### Building
```bash
# Build all modules
pnpm build

# Build specific modules
pnpm --filter frontend build
pnpm --filter cli build
```

## Security

- All inputs validated with Zod schemas
- Secrets zeroed from memory after use
- Non-malleable Bitcoin scripts
- Reentrancy protection in Ethereum contracts
- No unverified redeemers
- Comprehensive error handling and logging

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: [docs.fusion.plus](https://docs.fusion.plus/)
- Issues: [GitHub Issues](https://github.com/art3mis/fusion-xbtc/issues)
- Discussions: [GitHub Discussions](https://github.com/art3mis/fusion-xbtc/discussions) 