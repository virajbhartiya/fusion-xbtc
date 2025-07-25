import { z } from 'zod';

const argsSchema = z.object({
  txid: z.string(),
  network: z.string().default('testnet'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

console.log(JSON.stringify({
  action: 'btc-watcher',
  txid: args.txid,
  network: args.network,
  note: 'Stub: would monitor BTC HTLC for redeem/refund events',
}, null, 2)); 