import { z } from 'zod';
import * as bitcoin from 'bitcoinjs-lib';
import { buildHTLCScript, getNetwork } from '../btc-scripts/htlc.ts';
import ElectrumClient from 'electrum-client';
import { buildLockTx } from '../btc-scripts/tx-builder.ts';
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const network = args.network === 'testnet' 
  ? bitcoin.networks.testnet 
  : getNetwork(args.chain as 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch');
const hashlock = Buffer.from(args.hashlock.replace(/^0x/, ''), 'hex');
const recipientPubkey = Buffer.from(args.recipientPubkey, 'hex');
const refundPubkey = Buffer.from(args.refundPubkey, 'hex');
const locktime = parseInt(args.locktime, 10);
const htlc = buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime, network });

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
  console.log('Starting BTC lock transaction...');
  const utxos = JSON.parse(fullArgs.utxos).map((u: any) => ({
    txid: u.txid,
    vout: u.vout,
    value: u.amount,
    keyPair: ECPair.fromWIF(u.wif, network)
  }));
  console.log('UTXOs processed:', utxos.length);
  
  const psbt = buildLockTx({
    utxos,
    htlcAddress: htlc.address!,
    amountSats: parseInt(fullArgs.amount, 10),
    changeAddress: fullArgs.changeAddress,
    feeSats: parseInt(fullArgs.feeSats, 10),
    network
  });
  console.log('PSBT built successfully');
  
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  console.log('Transaction hex generated:', txHex.substring(0, 100) + '...');
  console.log('Full transaction hex:', txHex);
  
  let txid: string;
  try {
    const client = new ElectrumClient(
      parseInt(fullArgs.electrumPort, 10),
      fullArgs.electrumHost,
      fullArgs.electrumProto
    );
    console.log('Connecting to Electrum server...');
    await (client as any).connect();
    console.log('Broadcasting transaction...');
    txid = await client.blockchainTransaction_broadcast(txHex);
    await (client as any).close();
    console.log('Transaction broadcasted successfully:', txid);
  } catch (error) {
    console.log('Failed to broadcast transaction via Electrum server:', error.message);
    console.log('You can manually broadcast the transaction hex above using a Bitcoin testnet explorer or wallet.');
    console.log('Transaction hex for manual broadcast:', txHex);
    process.exit(1);
  }
  const chain = args.chain as 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch';
  const logDir = chain === 'dogecoin'
    ? path.resolve(__dirname, '../examples/doge')
    : chain === 'litecoin'
      ? path.resolve(__dirname, '../examples/ltc')
      : chain === 'bch'
        ? path.resolve(__dirname, '../examples/bch')
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