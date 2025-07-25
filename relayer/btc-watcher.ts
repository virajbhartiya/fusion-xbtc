import { z } from 'zod';
import ElectrumClient from 'electrum-client';
import * as bitcoin from 'bitcoinjs-lib';

const argsSchema = z.object({
  txid: z.string(),
  vout: z.string(),
  script: z.string(),
  electrumHost: z.string(),
  electrumPort: z.string(),
  electrumProto: z.string().default('ssl'),
  network: z.string().default('testnet'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  const client = new ElectrumClient(
    parseInt(args.electrumPort, 10),
    args.electrumHost,
    args.electrumProto
  );
  await (client as any).connect();
  const tx = await client.blockchainTransaction_get(args.txid, true);
  const vout = parseInt(args.vout, 10);
  const output = tx.vout[vout];
  const scriptHex = args.script;
  const scriptHash = bitcoin.crypto.sha256(Buffer.from(scriptHex, 'hex')).reverse().toString('hex');
  const history = await client.blockchainScripthash_getHistory(scriptHash);
  for (const h of history) {
    const spendTx = await client.blockchainTransaction_get(h.tx_hash, true);
    for (const vin of spendTx.vin) {
      if (vin.txid === args.txid && vin.vout === vout) {
        // Try to extract secret from scriptSig or witness
        const witness = vin.txinwitness || vin.witness;
        if (witness && witness.length > 1) {
          const secret = witness[1];
          console.log(JSON.stringify({
            event: 'btc-redeem',
            txid: h.tx_hash,
            secret,
          }, null, 2));
        } else {
          console.log(JSON.stringify({
            event: 'btc-refund',
            txid: h.tx_hash,
          }, null, 2));
        }
      }
    }
  }
  await (client as any).close();
}

main(); 