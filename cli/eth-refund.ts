import { z } from 'zod';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const argsSchema = z.object({
  rpc: z.string(),
  contract: z.string(),
  hashlock: z.string(),
  senderPrivkey: z.string(),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  const provider = new ethers.JsonRpcProvider(args.rpc);
  const wallet = new ethers.Wallet(args.senderPrivkey, provider);
  const abi = [
    'function refund(bytes32 hashlock) external'
  ];
  const contract = new ethers.Contract(args.contract, abi, wallet);
  const tx = await contract.refund(args.hashlock);
  const receipt = await tx.wait();
  console.log(JSON.stringify({
    event: 'eth-refund',
    txHash: receipt.transactionHash,
    status: receipt.status,
  }, null, 2));
  const logDir = path.resolve(__dirname, '../examples/swaps');
  const logPath = path.join(logDir, `${args.hashlock}.json`);
  let logData = {};
  if (fs.existsSync(logPath)) {
    logData = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  }
  Object.assign(logData, {
    intentId: args.hashlock,
    status: 'refunded',
    ethTx: receipt.transactionHash,
    timestamp: Date.now(),
  });
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
}

main(); 