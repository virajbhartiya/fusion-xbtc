# implementation.md — Fusion+ Bitcoin Bridge

## Objective

Incrementally build **Fusion+ Bitcoin-Ethereum Bridge** in tightly scoped, independently functioning stages.  
Each stage:
- Is self-contained and produces a testable artifact.
- Avoids speculative code and generalization.
- Only mocks downstream modules when strictly necessary.
- Anchors to onchain truth (BTC and ETH testnets).

---

## STAGE 0 — MONOREPO + BUILD PIPELINE

**Goal:** Initialize project workspace and toolchain for multi-chain dev.

**Steps:**
- [x] Init `pnpm` monorepo: `eth-contracts/`, `btc-scripts/`, `relayer/`, `cli/`, `examples/`
- [x] Install core tooling:
  - Ethereum: `hardhat`, `ethers`, `viem`, `solidity`, `forge`
  - Bitcoin: `bitcoinjs-lib`, `bitcore-lib`, `electrum-client`
- [x] Add shell CLI (`pnpm cli`) with single stub command
- [x] Create shared types in `common/types.ts`: `HTLCParams`, `SwapDirection`, `SwapState`

**Output:** Monorepo compiles. CLI and contracts test runners execute. Structure in place.

---

## STAGE 1 — ETHEREUM HTLC CONTRACT

**Goal:** Deploy lockable + redeemable ETH-based HTLC contract.

**Steps:**
- [x] Write `ETHHTLC.sol` with `lock`, `redeem`, `refund`
- [x] Support `hashlock`, `timelock`, `recipient`, `sender`
- [x] Emit events: `Locked`, `Redeemed`, `Refunded`
- [ ] Deploy to Goerli or Sepolia with simple CLI wrapper

**Output:** ETH user can lock and redeem funds using secret preimage. Events emitted onchain.

---

## STAGE 2 — BITCOIN HTLC SCRIPT + TX BUILDER

**Goal:** Lock BTC to a hash-locked script with manual transaction creation.

**Steps:**
- [ ] Write raw Bitcoin script (P2SH) using `OP_SHA256`, `OP_CHECKLOCKTIMEVERIFY`, `OP_CHECKSIG`
- [ ] Build transaction that:
  - Sends BTC to the script
  - Broadcasts via Bitcoin Testnet node (regtest fallback)
- [ ] Write script extractor + parser for validation

**Output:** BTC locked into HTLC address. Script verified. Redeem path calculable.

---

## STAGE 3 — MANUAL SWAP DEMO (NO RELAYER)

**Goal:** Run end-to-end ETH → BTC swap using CLI and manual secret propagation.

**Steps:**
- [ ] CLI: `swap-cli eth2btc --amount 0.01 --recipient <btc-pubkey>`
  - Locks ETH
  - Outputs secret + hash
- [ ] CLI: `swap-cli btc-redeem --hashlock <hash> --secret <preimage>`
  - Signs redeem tx for BTC
- [ ] Confirm:
  - ETH contract `Redeemed` event emitted
  - BTC UTXO spent with correct preimage

**Output:** Full swap path executed. Secret revealed on ETH. BTC successfully redeemed using it.

---

## STAGE 4 — RELAYER SERVICE (OFFCHAIN COORDINATOR)

**Goal:** Build stateless relay engine that monitors chains and relays secrets.

**Steps:**
- [ ] Monitor ETH HTLC contract for `Redeemed(secret)`
- [ ] Parse tx logs and extract `secret`
- [ ] Compose BTC redeem tx with `secret`
- [ ] Broadcast via Electrum or RPC node
- [ ] Backfill: monitor BTC HTLC as well (for reverse direction)

**Output:** Relayer listens on both chains and redeems HTLCs without human intervention.

---

## STAGE 5 — BTC → ETH SWAP

**Goal:** Enable BTC user to initiate swap and ETH user to redeem.

**Steps:**
- [ ] CLI: `swap-cli btc2eth --amount 0.002 --recipient <eth-address>`
  - Locks BTC in HTLC
  - Outputs secret + hash
- [ ] ETH user uses hash to call `lock` on ETH HTLC
- [ ] BTC redeemer redeems BTC with preimage
- [ ] ETH user picks up secret and redeems ETH

**Output:** Reverse direction flow works. BTC HTLC drives ETH redemption path.

---

## STAGE 6 — TIMEOUT + REFUND PATHS

**Goal:** Ensure funds are recoverable if counterparty is unresponsive.

**Steps:**
- [ ] Wait until `timelock` expires on ETH side
- [ ] Trigger `refund()` → ETH returned to sender
- [ ] On BTC side, broadcast refund tx using timeout path
- [ ] Assert balances post-refund

**Output:** All timeout paths executable. Swaps fail gracefully without loss.

---

## STAGE 7 — CLI POLISH + VALIDATION

**Goal:** Wrap all swap paths into ergonomic, verifiable CLI.

**Steps:**
- [ ] Validate inputs: pubkeys, addresses, network
- [ ] Add dry-run and confirm prompts
- [ ] JSON logs of each step in `/examples/swaps/`
- [ ] Add test mode: `--simulate` → no broadcast, outputs all steps

**Output:** Single CLI can run both swap paths end-to-end with logs.

---

## STAGE 8 — EXTENSION TO DOGE + LTC

**Goal:** Reuse Bitcoin HTLC implementation across similar chains.

**Steps:**
- [ ] Replace Bitcoin network params with Dogecoin / Litecoin
- [ ] Adjust fee calculation + tx serialization (different sig versions)
- [ ] Test:
  - ETH → LTC
  - ETH → DOGE
- [ ] Logs stored per-chain under `/examples/doge/`, `/examples/ltc/`

**Output:** Same ETH contract supports multiple UTXO chains via script config.

---

## STAGE 9 — FRONTEND SWAP DEMO (MINIMAL)

**Goal:** Provide visual demo for hackathon/pitch.

**Steps:**
- [ ] Build single-page React frontend:
  - Select direction (ETH→BTC or BTC→ETH)
  - Enter amount + recipient
  - Show secret + confirmation
- [ ] Pull status from both chains (lock status, redemption)
- [ ] No wallet integration — txs shown as raw data or QR

**Output:** Live interface to simulate swaps with visible chain state.

---

## STAGE 10 — BENCHMARKS + METRICS

**Goal:** Document performance, latency, and economics of bridge.

**Steps:**
- [ ] Measure:
  - Lock → Redeem latency
  - Average gas cost on ETH
  - Avg BTC tx fee
- [ ] Swap success/failure stats
- [ ] Manual vs relayed secret propagation

**Output:** Markdown + table of metrics. Screenshot-ready for final pitch.

---

## FINAL DEMO PATH

```txt
1. ETH user initiates swap via CLI
2. BTC user receives hash → creates HTLC
3. ETH user redeems → secret revealed
4. Relayer uses secret to redeem BTC
5. UI updates in real time
6. Logs and benchmarks exported
````

---

## LLM Directive

* All modules must adhere to `spec.md` definitions.
* No abstractions outside CLI, Relayer, HTLC-ETH, HTLC-BTC modules.
* All test vectors must be saved in `/examples/`.
* Use raw transaction inspection, not SDK abstractions, for BTC.
* Ethereum logic must be fully verifiable by event logs.
* Only preimage-reveal driven flow is valid—no shortcuts.
