import crypto from 'crypto';
import { z } from 'zod';

const argsSchema = z.object({
  amount: z.string(),
  recipient: z.string(),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

const secret = crypto.randomBytes(32);
const hashlock = crypto.createHash('sha256').update(secret).digest('hex');

console.log(JSON.stringify({
  secret: secret.toString('hex'),
  hashlock,
  amount: args.amount,
  recipient: args.recipient,
}, null, 2)); 