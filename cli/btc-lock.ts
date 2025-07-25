import { z } from 'zod';
import * as bitcoin from 'bitcoinjs-lib';
import { buildHTLCScript, getNetwork } from '../btc-scripts/htlc.js';
import ElectrumClient from 'electrum-client';
import { buildLockTx } from '../btc-scripts/tx-builder.js';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import fs from 'fs';
import path from 'path';

const ECPair = ECPairFactory(tinysecp);

const argsSchema = z.object({
  hashlock: z.string(),
  recipientPubkey: z.string(),
  refundPubkey: z.string(),
  locktime: z.string(),
  amount: z.string(),
  network: z.string().default('testnet'),
  chain: z.string().default('bitcoin'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

const network = getNetwork(args.chain as 'bitcoin' | 'litecoin' | 'dogecoin');
const hashlock = Buffer.from(args.hashlock.replace(/^0x/, ''), 'hex');
const recipientPubkey = Buffer.from(args.recipientPubkey, 'hex');
const refundPubkey = Buffer.from(args.refundPubkey, 'hex');
const locktime = parseInt(args.locktime, 10);
const htlc = buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime });

const extendedArgsSchema = argsSchema.extend({
  utxos: z.string(), // JSON stringified array of UTXOs
  changeAddress: z.string(),
  feeSats: z.string(),
  electrumHost: z.string(),
  electrumPort: z.string(),
  electrumProto: z.string().default('ssl'),
});

const fullArgs = extendedArgsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  const utxos = JSON.parse(fullArgs.utxos).map((u: any) => ({
    ...u,
    keyPair: ECPair.fromWIF(u.wif, network)
  }));
  const psbt = buildLockTx({
    utxos,
    htlcAddress: htlc.address!,
    amountSats: parseInt(fullArgs.amount, 10),
    changeAddress: fullArgs.changeAddress,
    feeSats: parseInt(fullArgs.feeSats, 10),
    network
  });
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  const client = new ElectrumClient(
    parseInt(fullArgs.electrumPort, 10),
    fullArgs.electrumHost,
    fullArgs.electrumProto
  );
  await client.connect();
  const txid = await client.blockchain_transaction_broadcast(txHex);
  await client.close();
  const chain = args.chain as 'bitcoin' | 'litecoin' | 'dogecoin';
  const logDir = chain === 'dogecoin'
    ? path.resolve(__dirname, '../examples/doge')
    : chain === 'litecoin'
      ? path.resolve(__dirname, '../examples/ltc')
      : path.resolve(__dirname, '../examples/swaps');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${args.hashlock}.json`);
  const logData = {
    intentId: args.hashlock,
    status: 'locked',
    btcTx: txid,
    amount: fullArgs.amount,
    htlcAddress: htlc.address,
    timestamp: Date.now(),
  };
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
  console.log(JSON.stringify({
    event: 'btc-lock',
    txid,
    htlcAddress: htlc.address,
    redeemScript: htlc.redeem?.output?.toString('hex') || htlc.output?.toString('hex'),
    status: 'broadcasted',
  }, null, 2));
}

main(); 