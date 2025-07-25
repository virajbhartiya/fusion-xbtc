import { ethers } from 'ethers';
import { z } from 'zod';
import ElectrumClient from 'electrum-client';
import * as bitcoin from 'bitcoinjs-lib';
import { buildHTLCScript } from '../btc-scripts/htlc.js';
import { buildLockTx } from '../btc-scripts/tx-builder.js';

const argsSchema = z.object({
  rpc: z.string(),
  contract: z.string(),
  btcRecipientPubkey: z.string(),
  btcRefundPubkey: z.string(),
  btcLocktime: z.string(),
  btcUtxos: z.string(), // JSON stringified array
  btcRedeemAddress: z.string(),
  btcChangeAddress: z.string(),
  btcAmountSats: z.string(),
  btcFeeSats: z.string(),
  btcNetwork: z.string().default('testnet'),
  electrumHost: z.string(),
  electrumPort: z.string(),
  electrumProto: z.string().default('ssl'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function broadcastBtcRedeem(secret: string, hashlock: string) {
  const network = bitcoin.networks[args.btcNetwork];
  const recipientPubkey = Buffer.from(args.btcRecipientPubkey, 'hex');
  const refundPubkey = Buffer.from(args.btcRefundPubkey, 'hex');
  const locktime = parseInt(args.btcLocktime, 10);
  const hashlockBuf = Buffer.from(hashlock.replace(/^0x/, ''), 'hex');
  const htlc = buildHTLCScript({ hashlock: hashlockBuf, recipientPubkey, refundPubkey, locktime });
  const utxos = JSON.parse(args.btcUtxos);
  const psbt = buildLockTx({
    utxos,
    htlcAddress: args.btcRedeemAddress,
    amountSats: parseInt(args.btcAmountSats, 10),
    changeAddress: args.btcChangeAddress,
    feeSats: parseInt(args.btcFeeSats, 10),
    network,
  });
  // Broadcast via Electrum
  const client = new ElectrumClient(
    parseInt(args.electrumPort, 10),
    args.electrumHost,
    args.electrumProto
  );
  await client.connect();
  const txHex = psbt.finalizeAllInputs().extractTransaction().toHex();
  const txid = await client.blockchain_transaction_broadcast(txHex);
  await client.close();
  console.log(JSON.stringify({
    event: 'btc-redeem-broadcast',
    txid,
  }, null, 2));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(args.rpc);
  const abi = [
    'event Redeemed(bytes32 indexed hashlock, bytes32 secret, address indexed recipient)'
  ];
  const contract = new ethers.Contract(args.contract, abi, provider);
  contract.on('Redeemed', async (hashlock, secret, recipient, event) => {
    console.log(JSON.stringify({
      event: 'Redeemed',
      hashlock,
      secret,
      recipient,
      txHash: event.transactionHash
    }, null, 2));
    await broadcastBtcRedeem(secret, hashlock);
  });
  console.log('Listening for Redeemed events...');
}

main(); 