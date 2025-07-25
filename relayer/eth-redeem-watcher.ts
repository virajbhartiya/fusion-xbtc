import { ethers } from 'ethers';
import { z } from 'zod';

const argsSchema = z.object({
  rpc: z.string(),
  contract: z.string(),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

async function main() {
  const provider = new ethers.JsonRpcProvider(args.rpc);
  const abi = [
    'event Redeemed(bytes32 indexed hashlock, bytes32 secret, address indexed recipient)'
  ];
  const contract = new ethers.Contract(args.contract, abi, provider);
  contract.on('Redeemed', (hashlock, secret, recipient, event) => {
    console.log(JSON.stringify({
      event: 'Redeemed',
      hashlock,
      secret,
      recipient,
      txHash: event.transactionHash
    }, null, 2));
  });
  console.log('Listening for Redeemed events...');
}

main(); 