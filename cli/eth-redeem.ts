import { z } from 'zod';
import { ethers } from 'ethers';

const argsSchema = z.object({
  rpc: z.string(),
  contract: z.string(),
  secret: z.string(),
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
    'function redeem(bytes32 secret) external'
  ];
  const contract = new ethers.Contract(args.contract, abi, wallet);
  const tx = await contract.redeem(args.secret);
  const receipt = await tx.wait();
  console.log(JSON.stringify({
    event: 'eth-redeem',
    txHash: receipt.transactionHash,
    status: receipt.status,
  }, null, 2));
}

main(); 