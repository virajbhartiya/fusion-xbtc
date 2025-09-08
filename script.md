## Updated Video Script: QuantumSwap - Trustless Atomic Swaps Demo

### Introduction (30 seconds)
"Hi everyone! Today I'm going to show you QuantumSwap, a trustless atomic swap platform that lets you exchange Ethereum for Bitcoin without any intermediaries. This is a complete implementation with a web interface, CLI tools, and automated relayer service."

### What is QuantumSwap (45 seconds)
"QuantumSwap uses Hash Time-Locked Contracts, or HTLCs, to ensure both parties can't cheat. Here's how it works:
- You lock your ETH in a smart contract with a secret hash
- The counterparty locks their BTC in a Bitcoin script with the same hash
- When either party reveals the secret, both can claim their funds
- If no one reveals the secret within the time limit, funds are automatically refunded
- No trusted third party needed - it's completely decentralized"

### Architecture Overview (30 seconds)
"The system consists of four main components:
- Smart contracts on Ethereum for ETH locking
- Bitcoin scripts for BTC locking
- A web frontend for easy interaction
- A relayer service that monitors both chains and automates the process"

### Demo Setup (15 seconds)
"Let me show you the live deployment at swap.virajbhartiya.com. This is running on an EC2 instance with SSL certificates and proper production setup."

### Live Demo Walkthrough (2 minutes)

#### Frontend Interface
"Here's the main interface. You can see:
- Connection to MetaMask for Ethereum
- Connection to Unisat for Bitcoin
- Current network status showing Sepolia testnet
- Contract addresses loaded from environment variables"

#### Creating a Swap
"Let's create a swap:
1. **Enter the amount of ETH you want to send** - this locks your ETH in the smart contract
2. **Enter the amount of BTC you want to receive** - this shows exactly what you'll get
3. **Set the recipient addresses** - where you want the BTC to be sent
4. **Click 'Create Swap'** - this will lock your ETH in the smart contract"

#### Live Exchange Rate
"Notice the live exchange rate display:
- Shows current ETH to BTC rate from multiple sources
- Updates automatically every 30 seconds
- If live rates fail, uses estimated rates as fallback
- You can manually refresh the rates if needed"

#### Monitoring the Swap
"Once created, you can see:
- The swap status: 'Pending', 'Locked', 'Redeemed', or 'Refunded'
- Transaction hashes on both chains
- Time remaining before refund is possible
- The secret hash that secures the swap"

#### Completing the Swap
"When the counterparty locks their BTC, you can:
1. Reveal the secret to claim your BTC
2. The relayer automatically detects this and claims your ETH
3. Both parties get their funds atomically"

### Technical Features (45 seconds)
"Key technical features include:
- Full TypeScript implementation for type safety
- Comprehensive error handling and validation
- Automated relayer service that runs 24/7
- Support for multiple Bitcoin variants: BTC, LTC, DOGE, BCH
- Integration with 1inch Fusion+ protocol
- Production-ready with SSL, monitoring, and logging"

### CLI Tools (30 seconds)
"For advanced users, there are CLI tools:
- Create and manage orders
- Execute HTLC operations directly
- Monitor swap status
- Partial fill support for large orders"

### Security & Trustlessness (30 seconds)
"The system is completely trustless:
- No custodians or intermediaries
- All operations are on-chain
- Time-locked refunds prevent funds from being stuck
- Cryptographic proofs ensure atomicity
- Open source and auditable"

### Conclusion (15 seconds)
"QuantumSwap demonstrates how atomic swaps can enable truly decentralized cross-chain trading. The code is open source and production-ready. You can try it yourself at swap.virajbhartiya.com or check out the GitHub repository for the full implementation."

### Call to Action (15 seconds)
"Thanks for watching! If you're interested in atomic swaps or cross-chain DeFi, check out the project on GitHub and try the demo. Questions and contributions are welcome!"

---

**Key Changes in Demo:**
- **Dual input fields**: Now shows both "Amount to Send" (ETH) and "Amount to Receive" (BTC)
- **Live rate calculation**: Automatically calculates the other amount as you type
- **Clear labeling**: "Amount to Send" vs "Amount to Receive" makes it crystal clear
- **Real-time updates**: Exchange rates update automatically
- **Better UX**: Users can input either amount and see the other calculated instantly

**Demo Flow:**
1. Show the live website
2. Walk through the dual input fields
3. Demonstrate the live rate calculation
4. Show the monitoring interface
5. Demonstrate the CLI tools
6. Highlight the security features

The frontend now has both input fields as requested - users can enter how much ETH they want to send AND how much BTC they want to receive!