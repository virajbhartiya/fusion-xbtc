# Fusion+ HTLC Cross-Chain Swap Demo Guide

## Project Overview

This project implements a cross-chain atomic swap system using Hash Time-Locked Contracts (HTLCs) with integration to the 1inch Fusion+ protocol. It allows users to swap ETH and BTC across different blockchains without requiring a trusted third party.

## Key Components

### 1. Smart Contracts (`eth-contracts/`)

#### ETHHTLC.sol
- **Purpose**: Basic HTLC implementation for Ethereum
- **Key Functions**:
  - `lock(bytes32 hashlock, address recipient, uint256 timelock)`: Locks ETH with a hashlock and timelock
  - `redeem(bytes32 secret)`: Redeems locked ETH by providing the secret preimage
  - `refund(bytes32 hashlock)`: Allows sender to refund after timelock expires
- **Security**: Uses SHA256 for hashlock computation

#### FusionHTLC.sol
- **Purpose**: Extends ETHHTLC to integrate with 1inch Fusion+ protocol
- **Key Functions**:
  - `createFusionOrder()`: Creates a Fusion+ order for cross-chain swap
  - `matchFusionOrder()`: Matches an existing order by taking the opposite side
  - `cancelFusionOrder()`: Cancels an order after timelock expires
- **Events**: Emits events for order creation, matching, and cancellation

### 2. Frontend Application (`frontend/`)

#### Main Features
- **Wallet Integration**: MetaMask for Ethereum, Unisat/Hiro/Xverse for Bitcoin
- **Order Management**: Create, view, and match Fusion+ orders
- **Real-time Exchange Rates**: Fetches live ETH/BTC rates from multiple sources
- **Transaction Tracking**: Displays all transaction hashes with Etherscan links

#### Key Components
- **Order Creation**: Users can create Fusion+ orders with custom amounts and timelocks
- **Order Matching**: Users can match existing orders (requires original secret)
- **Status Tracking**: Real-time status updates for all operations
- **Transaction History**: Complete transaction hash tracking

### 3. Backend Services (`backend/`, `relayer/`)

#### Relayer Service
- **Purpose**: Monitors blockchain events and facilitates cross-chain operations
- **Functions**:
  - Polls for HTLC events on both chains
  - Extracts secrets from redeemed transactions
  - Triggers corresponding operations on the opposite chain
  - Maintains transaction logs

## Technical Architecture

### HTLC Protocol Flow

1. **Secret Generation**: Random 32-byte secret generated
2. **Hashlock Creation**: SHA256 hash of the secret
3. **Lock on Source Chain**: Funds locked with hashlock and timelock
4. **Lock on Destination Chain**: Counterparty locks funds with same hashlock
5. **Redeem on Destination**: Secret revealed to unlock funds
6. **Redeem on Source**: Secret used to unlock original funds

### Fusion+ Integration

1. **Order Creation**: User creates order with maker/taker assets and amounts
2. **Order Discovery**: Orders visible to all users on the network
3. **Order Matching**: Users can match orders by providing the secret
4. **Atomic Execution**: Both sides execute simultaneously

### Security Features

- **Hashlock Verification**: SHA256 ensures secret integrity
- **Timelock Protection**: Prevents indefinite locking of funds
- **Non-malleable Scripts**: Bitcoin scripts designed to prevent malleability
- **Reentrancy Protection**: Smart contracts protected against reentrancy attacks
- **Input Validation**: All inputs validated with Zod schemas

## Demo Walkthrough

### Prerequisites
- MetaMask wallet connected to Sepolia testnet
- Some test ETH on Sepolia
- Bitcoin wallet (Unisat/Hiro/Xverse) for BTC operations

### Step 1: Connect Wallets
1. Click "Connect MetaMask" to connect Ethereum wallet
2. Select Bitcoin wallet provider (Unisat/Hiro/Xverse)
3. Verify both wallets are connected and addresses are displayed

### Step 2: Create a Fusion+ Order
1. Select swap direction (ETH→BTC or BTC→ETH)
2. Enter amount to swap
3. Set timelock (default 1 hour)
4. Click "Create Fusion+ Order"
5. Confirm transaction in MetaMask
6. Note the transaction hash and order ID

### Step 3: View Available Orders
1. Click "Load Available Orders" to see all orders on the network
2. Orders show:
   - Maker/taker assets and amounts
   - Exchange rate vs market rate
   - Status (active/completed)
   - Transaction hashes
   - Timelock information

### Step 4: Match an Order
1. Select an order from the list
2. If you have the original secret, click "Match this order"
3. Confirm transaction in MetaMask
4. Order status updates to "completed"
5. Transaction hash displayed for verification

### Step 5: Monitor Transactions
- All transaction hashes are displayed with Etherscan links
- Real-time status updates
- Complete transaction history maintained

## Q&A Preparation

### Technical Questions

**Q: How does the HTLC protocol ensure atomicity?**
A: The protocol uses a two-phase commit with hashlock verification. Both parties must lock funds before either can redeem. The secret revelation enables redemption on both chains, ensuring atomic execution.

**Q: What happens if the timelock expires?**
A: The original sender can refund their locked funds after the timelock expires. This prevents indefinite locking of assets.

**Q: How is the secret generated and secured?**
A: Secrets are cryptographically random 32-byte values generated using the Web Crypto API. They're stored locally and never transmitted in plain text.

**Q: What prevents double-spending or replay attacks?**
A: The smart contract tracks redemption status and prevents multiple redemptions. Each hashlock can only be used once.

**Q: How does the Fusion+ integration work?**
A: Fusion+ orders are created on-chain with maker/taker specifications. Users can discover and match orders without requiring direct counterparty coordination.

### Security Questions

**Q: What if someone tries to redeem with the wrong secret?**
A: The smart contract verifies the SHA256 hash of the provided secret matches the hashlock. Wrong secrets will cause the transaction to revert.

**Q: How do you prevent front-running attacks?**
A: The protocol uses time-locked commitments. Once funds are locked, they cannot be withdrawn until the secret is revealed or timelock expires.

**Q: What happens if the blockchain is congested?**
A: Users can increase gas fees for faster processing. The timelock provides a safety buffer for transaction delays.

### Business Questions

**Q: What are the advantages over centralized exchanges?**
A: No custodial risk, no KYC requirements, no single point of failure, and true atomic cross-chain swaps.

**Q: What are the limitations of this approach?**
A: Requires both parties to be online, limited to supported asset pairs, and requires understanding of blockchain operations.

**Q: How do you handle price volatility during the swap?**
A: The protocol uses fixed exchange rates set at order creation. Users should consider market conditions when setting rates.

**Q: What's the difference between this and other DEX solutions?**
A: This provides true atomic cross-chain swaps without requiring wrapped tokens or bridges, maintaining native asset properties.

### Implementation Questions

**Q: Why did you choose SHA256 over Keccak256?**
A: SHA256 is more widely supported across different blockchains and provides sufficient security for this use case.

**Q: How do you handle different blockchain confirmation times?**
A: The protocol uses different timelock durations for different chains (ETH: 1 hour, BTC: 2 hours) to account for varying confirmation speeds.

**Q: What's the role of the relayer service?**
A: The relayer monitors blockchain events and automates cross-chain operations, reducing manual intervention requirements.

**Q: How do you ensure the frontend and smart contracts stay in sync?**
A: The frontend reads directly from blockchain state and uses events for real-time updates. All critical operations are verified on-chain.

## Troubleshooting

### Common Issues

1. **"Invalid secret" error**: Ensure you're using SHA256 (not Keccak256) for hashlock computation
2. **Transaction fails**: Check gas fees and ensure sufficient balance
3. **Order not appearing**: Refresh the order list or check network connectivity
4. **Wallet connection issues**: Ensure wallet is unlocked and site permissions are granted

### Debug Information

- All transaction hashes are logged and displayed
- Console logs provide detailed operation tracking
- Network status and error messages are clearly displayed
- Etherscan links allow transaction verification

## Future Enhancements

1. **Multi-chain Support**: Extend to other blockchains (Polygon, Arbitrum, etc.)
2. **Advanced Order Types**: Limit orders, stop-loss orders
3. **Liquidity Pools**: Automated market making for instant swaps
4. **Mobile Support**: Native mobile applications
5. **API Integration**: REST API for third-party integrations

## Conclusion

This project demonstrates a complete cross-chain atomic swap system using HTLCs and Fusion+ integration. It provides a secure, decentralized way to exchange assets across different blockchains without requiring trusted intermediaries.

The implementation includes comprehensive error handling, transaction tracking, and user-friendly interfaces while maintaining the security guarantees of the underlying cryptographic protocols. 