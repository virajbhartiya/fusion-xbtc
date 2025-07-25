import { z } from 'zod';

const argsSchema = z.object({
  hashlock: z.string(),
  secret: z.string(),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

console.log(JSON.stringify({
  action: 'btc-redeem',
  hashlock: args.hashlock,
  secret: args.secret,
}, null, 2)); 