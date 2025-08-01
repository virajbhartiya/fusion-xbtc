import { z } from 'zod';
import ElectrumClient from 'electrum-client';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import { buildHTLCScript } from '../btc-scripts/htlc.js';
import { getNetwork } from '../btc-scripts/htlc.js';
import fs from 'fs';
import path from 'path';

const ECPair = ECPairFactory(tinysecp);

const argsSchema = z.object({
  utxoTxid: z.string(),
  utxoVout: z.string(),
  utxoAmount: z.string(),
  refundPrivkey: z.string(),
  htlcRecipientPubkey: z.string(),
  htlcRefundPubkey: z.string(),
  htlcLocktime: z.string(),
  htlcScript: z.string(),
  destAddress: z.string(),
  feeSats: z.string(),
  network: z.string().default('testnet'),
  electrumHost: z.string(),
  electrumPort: z.string(),
  electrumProto: z.string().default('ssl'),
  chain: z.string().default('bitcoin'),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  const network = getNetwork(args.chain as 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch');
  const client = new ElectrumClient(
    parseInt(args.electrumPort, 10),
    args.electrumHost,
    args.electrumProto
  );
  await client.connect();

  const refundPrivkey = ECPair.fromWIF(args.refundPrivkey, network);
  const signer = {
    publicKey: Buffer.from(refundPrivkey.publicKey),
    sign: refundPrivkey.sign.bind(refundPrivkey),
    signSchnorr: undefined,
  };
  const redeemScript = Buffer.from(args.htlcScript, 'hex');

  const psbt = new bitcoin.Psbt({ network });
  psbt.addInput({
    hash: args.utxoTxid,
    index: parseInt(args.utxoVout, 10),
    witnessUtxo: {
      script: redeemScript,
      value: parseInt(args.utxoAmount, 10),
    },
    redeemScript,
    sequence: 0, // allow locktime
  } as any);
  psbt.addOutput({
    address: args.destAddress,
    value: parseInt(args.utxoAmount, 10) - parseInt(args.feeSats, 10),
  });
  psbt.setLocktime(parseInt(args.htlcLocktime, 10));
  psbt.signInput(0, signer);
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  const txid = await client.blockchainTransaction_broadcast(txHex);
  await client.close();
  console.log(JSON.stringify({
    event: 'btc-refund',
    txid,
    status: 'broadcasted',
  }, null, 2));

  const chain = args.chain as 'bitcoin' | 'litecoin' | 'dogecoin' | 'bch';
  const logDir = chain === 'dogecoin'
    ? path.resolve(__dirname, '../examples/doge')
    : chain === 'litecoin'
      ? path.resolve(__dirname, '../examples/ltc')
      : chain === 'bch'
        ? path.resolve(__dirname, '../examples/bch')
        : path.resolve(__dirname, '../examples/swaps');
  const logPath = path.join(logDir, `${args.htlcScript}.json`); // Use htlcScript as unique identifier if hashlock not available
  let logData = {};
  if (fs.existsSync(logPath)) {
    logData = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  }
  Object.assign(logData, {
    intentId: args.htlcScript,
    status: 'refunded',
    btcTx: txid,
    timestamp: Date.now(),
  });
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
}

main(); 