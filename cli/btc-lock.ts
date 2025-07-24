import { z } from 'zod';
import * as bitcoin from 'bitcoinjs-lib';
import { buildHTLCScript } from '../btc-scripts/htlc.js';

const argsSchema = z.object({
  hashlock: z.string(),
  recipientPubkey: z.string(),
  refundPubkey: z.string(),
  locktime: z.string(),
  amount: z.string(),
  network: z.string().default('testnet'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

const network = bitcoin.networks[args.network];
const hashlock = Buffer.from(args.hashlock.replace(/^0x/, ''), 'hex');
const recipientPubkey = Buffer.from(args.recipientPubkey, 'hex');
const refundPubkey = Buffer.from(args.refundPubkey, 'hex');
const locktime = parseInt(args.locktime, 10);
const htlc = buildHTLCScript({ hashlock, recipientPubkey, refundPubkey, locktime });

console.log(JSON.stringify({
  htlcAddress: htlc.address,
  redeemScript: htlc.redeem?.output?.toString('hex') || htlc.output?.toString('hex'),
  amount: args.amount,
  network: args.network,
}, null, 2)); 