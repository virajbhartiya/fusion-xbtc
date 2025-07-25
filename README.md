# Fusion+ Bitcoin-Ethereum Bridge

## Overview

This project implements a trustless, atomic swap bridge between Ethereum and Bitcoin using Hash Time-Locked Contracts (HTLCs). It enables users to swap ETH for BTC (and vice versa) without custodians or wrapped assets, using onchain contracts and scripts.

## Monorepo Structure

- `eth-contracts/` — Ethereum HTLC contract (Solidity)
- `btc-scripts/` — Bitcoin HTLC script builder, tx builder, parser
- `cli/` — Command-line interface for swap flows
- `relayer/` — (WIP) Offchain relayer for secret propagation
- `common/` — Shared types
- `examples/` — Example swap flows and logs

## Quick Start

### 1. Install dependencies
```sh
pnpm install
```

### 2. Generate a swap secret and hashlock (ETH → BTC)
```sh
pnpm --filter cli exec ts-node eth2btc.ts --amount=0.01 --recipient=<btc-address-or-pubkey>
```
- Outputs a JSON object with `secret`, `hashlock`, `amount`, and `recipient`.

### 3. Redeem BTC with secret (manual path)
```sh
pnpm --filter cli exec ts-node btc-redeem.ts --hashlock=<hash> --secret=<preimage>
```
- Prints a stub for redeeming the BTC HTLC with the revealed secret.

### 4. Compile Ethereum contract
```sh
pnpm --filter eth-contracts exec hardhat compile
```
- Deploy with your preferred tool/script (see `eth-contracts/`).

## Architecture

- **ETH HTLC**: Solidity contract with `lock`, `redeem`, `refund` methods, using hashlock+timelock.
- **BTC HTLC**: P2SH script using `OP_SHA256`, `OP_CHECKLOCKTIMEVERIFY`, `OP_CHECKSIG`.
- **CLI**: Orchestrates swap flows, generates secrets, and simulates manual swaps.
- **Relayer**: (WIP) Listens for secret revelation and automates cross-chain redemption.

## Example Swap Flow

1. ETH user runs `eth2btc.ts` to generate secret/hashlock and lock ETH.
2. BTC user creates HTLC using the hashlock.
3. ETH user redeems BTC using the secret.
4. (Optional) Relayer automates secret extraction and redemption.

## Development
- All code is TypeScript (except Solidity contracts).
- See `implementation.md` and `spec.md` for full protocol details.

## Security
- All user inputs are validated with `zod`.
- No custodial logic or wrapped assets.
- Follows atomic swap best practices.

## License
MIT 