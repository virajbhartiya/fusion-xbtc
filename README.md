# Fusion+ Bitcoin-Ethereum Bridge

## Overview

This project implements a trustless, atomic swap bridge between Ethereum and Bitcoin using Hash Time-Locked Contracts (HTLCs). It enables users to swap ETH for BTC (and vice versa) without custodians or wrapped assets, using onchain contracts and scripts.

## Monorepo Structure

- `eth-contracts/` — Ethereum HTLC contract (Solidity)
- `btc-scripts/` — Bitcoin HTLC script builder, tx builder, parser
- `cli/` — Command-line interface for swap flows
- `relayer/` — Offchain relayer for secret propagation
- `common/` — Shared types
- `examples/` — Example swap flows and logs

## Quick Start

### 1. Install dependencies
```sh
pnpm install
```

---

## CLI Commands

All CLI commands are in the `cli/` directory and are run with ts-node:

### Generate ETH→BTC Swap Secret
```sh
pnpm --filter cli exec ts-node cli/eth2btc.ts --amount=<eth-amount> --recipient=<btc-address-or-pubkey>
```
- **Arguments:**
  - `--amount` (string): ETH amount to lock
  - `--recipient` (string): BTC address or pubkey
- **Output:** JSON with `secret`, `hashlock`, `amount`, `recipient`

### Generate BTC→ETH Swap Secret
```sh
pnpm --filter cli exec ts-node cli/btc2eth.ts --amount=<btc-amount> --recipient=<eth-address>
```
- **Arguments:**
  - `--amount` (string): BTC amount to lock
  - `--recipient` (string): ETH address
- **Output:** JSON with `secret`, `hashlock`, `amount`, `recipient`

### Lock ETH in HTLC
```sh
pnpm --filter cli exec ts-node cli/eth-lock.ts --rpc=<eth-rpc> --contract=<htlc-address> --hashlock=<hash> --timelock=<timestamp> --recipient=<eth-address> --amount=<eth-amount> --senderPrivkey=<privkey>
```
- **Arguments:**
  - `--rpc` (string): Ethereum RPC URL
  - `--contract` (string): HTLC contract address
  - `--hashlock` (string): 32-byte hash
  - `--timelock` (string): Unix timestamp (future)
  - `--recipient` (string): ETH address
  - `--amount` (string): ETH amount
  - `--senderPrivkey` (string): Sender's private key
- **Output:** JSON with `event`, `txHash`, `status`

### Redeem ETH from HTLC
```sh
pnpm --filter cli exec ts-node cli/eth-redeem.ts --rpc=<eth-rpc> --contract=<htlc-address> --secret=<preimage> --senderPrivkey=<privkey>
```
- **Arguments:**
  - `--rpc` (string): Ethereum RPC URL
  - `--contract` (string): HTLC contract address
  - `--secret` (string): Preimage/secret
  - `--senderPrivkey` (string): Redeemer's private key
- **Output:** JSON with `event`, `txHash`, `status`

### Refund ETH from HTLC
```sh
pnpm --filter cli exec ts-node cli/eth-refund.ts --rpc=<eth-rpc> --contract=<htlc-address> --hashlock=<hash> --senderPrivkey=<privkey>
```
- **Arguments:**
  - `--rpc` (string): Ethereum RPC URL
  - `--contract` (string): HTLC contract address
  - `--hashlock` (string): 32-byte hash
  - `--senderPrivkey` (string): Sender's private key
- **Output:** JSON with `event`, `txHash`, `status`

### Lock BTC in HTLC
```sh
pnpm --filter cli exec ts-node cli/btc-lock.ts --hashlock=<hash> --recipientPubkey=<hex> --refundPubkey=<hex> --locktime=<block/timestamp> --amount=<sats> --utxos=<json> --changeAddress=<btc-address> --feeSats=<sats> --electrumHost=<host> --electrumPort=<port> [--network=testnet] [--chain=bitcoin]
```
- **Arguments:**
  - `--hashlock` (string): 32-byte hash
  - `--recipientPubkey` (string): Redeemer's pubkey (hex)
  - `--refundPubkey` (string): Refunder's pubkey (hex)
  - `--locktime` (string): Block height or timestamp
  - `--amount` (string): Amount in sats
  - `--utxos` (string): JSON array of UTXOs (with WIF)
  - `--changeAddress` (string): BTC address for change
  - `--feeSats` (string): Fee in sats
  - `--electrumHost` (string): ElectrumX host
  - `--electrumPort` (string): ElectrumX port
  - `--network` (string, default: testnet)
  - `--chain` (string, default: bitcoin)
- **Output:** JSON with `event`, `txid`, `htlcAddress`, `redeemScript`, `status`

### Redeem BTC from HTLC
```sh
pnpm --filter cli exec ts-node cli/btc-redeem.ts --hashlock=<hash> --secret=<preimage> --utxoTxid=<txid> --utxoVout=<vout> --utxoAmount=<sats> --redeemPrivkey=<wif> --htlcRecipientPubkey=<hex> --htlcRefundPubkey=<hex> --htlcLocktime=<locktime> --htlcScript=<hex> --destAddress=<btc-address> --feeSats=<sats> --electrumHost=<host> --electrumPort=<port> [--network=testnet] [--chain=bitcoin]
```
- **Arguments:**
  - All required for redeeming from HTLC (see script)
- **Output:** JSON with `event`, `txid`, `status`

### Refund BTC from HTLC
```sh
pnpm --filter cli exec ts-node cli/btc-refund.ts --utxoTxid=<txid> --utxoVout=<vout> --utxoAmount=<sats> --refundPrivkey=<wif> --htlcRecipientPubkey=<hex> --htlcRefundPubkey=<hex> --htlcLocktime=<locktime> --htlcScript=<hex> --destAddress=<btc-address> --feeSats=<sats> --electrumHost=<host> --electrumPort=<port> [--network=testnet] [--chain=bitcoin]
```
- **Arguments:**
  - All required for refunding from HTLC (see script)
- **Output:** JSON with `event`, `txid`, `status`

### Track Swap Status
```sh
pnpm --filter cli exec ts-node cli/track.ts --hashlock=<hash>
```
- **Arguments:**
  - `--hashlock` (string): Swap hashlock
- **Output:** JSON log for the swap

---

## Relayer Usage

### BTC Redeem Automation
```sh
pnpm --filter relayer exec ts-node relayer/btc-redeem.ts <args>
```
- Automates BTC redeem with secret and logs output

### BTC Watcher
```sh
pnpm --filter relayer exec ts-node relayer/btc-watcher.ts --txid=<txid> --vout=<vout> --script=<hex> --electrumHost=<host> --electrumPort=<port> [--network=testnet]
```
- Watches for BTC HTLC spends and extracts secrets

### ETH Redeem Watcher
```sh
pnpm --filter relayer exec ts-node relayer/eth-redeem-watcher.ts --rpc=<eth-rpc> --contract=<htlc-address> --btcRecipientPubkey=<hex> --btcRefundPubkey=<hex> --btcLocktime=<locktime> --btcUtxos=<json> --btcRedeemAddress=<btc-address> --btcChangeAddress=<btc-address> --btcAmountSats=<sats> --btcFeeSats=<sats> --btcNetwork=<network> --electrumHost=<host> --electrumPort=<port>
```
- Listens for ETH HTLC redemption and triggers BTC redeem

---

## Ethereum Contract

### Compile
```sh
pnpm --filter eth-contracts exec hardhat compile
```

### Deploy
- Use your preferred tool/script (see `eth-contracts/`).
- Contract: `ETHHTLC.sol`

### ABI
- `lock(bytes32 hashlock, address recipient, uint256 timelock)`
- `redeem(bytes32 secret)`
- `refund(bytes32 hashlock)`

---

## Example Swap Flow

1. Generate secret/hashlock with `eth2btc.ts` or `btc2eth.ts`.
2. Lock ETH or BTC using the respective lock command.
3. Redeem on the opposite chain using the revealed secret.
4. Use relayer for automation (optional).
5. Track status with `track.ts`.

---

## Development
- All code is TypeScript (except Solidity contracts).
- See `implementation.md` and `spec.md` for full protocol details.

## Security
- All user inputs are validated with `zod`.
- No custodial logic or wrapped assets.
- Follows atomic swap best practices.

## License
MIT 