import { z } from 'zod';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argsSchema = z.object({
  rpc: z.string(),
  contract: z.string(),
  hashlock: z.string(),
  timelock: z.string(),
  recipient: z.string(),
  amount: z.string(),
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
    'function lock(bytes32 hashlock, address recipient, uint256 timelock) external payable'
  ];
  const contract = new ethers.Contract(args.contract, abi, wallet);
  const tx = await contract.lock(args.hashlock, args.recipient, args.timelock, { value: ethers.parseEther(args.amount) });
  const receipt = await tx.wait();
  console.log(JSON.stringify({
    event: 'eth-lock',
    txHash: receipt.transactionHash,
    status: receipt.status,
  }, null, 2));
  const logDir = path.resolve(__dirname, '../examples/swaps');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${args.hashlock}.json`);
  const logData = {
    intentId: args.hashlock,
    status: 'locked',
    ethTx: receipt.transactionHash,
    amount: args.amount,
    recipient: args.recipient,
    timestamp: Date.now(),
  };
  fs.writeFileSync(logPath, JSON.stringify(logData, null, 2));
}

main(); 