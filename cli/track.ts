import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const argsSchema = z.object({
  hashlock: z.string(),
});

const args = argsSchema.parse(Object.fromEntries(process.argv.slice(2).map(arg => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  return [k, v];
})));

const logDir = path.resolve(__dirname, '../examples/swaps');
const logPath = path.join(logDir, `${args.hashlock}.json`);
if (!fs.existsSync(logPath)) {
  console.error(JSON.stringify({ error: 'No log found for hashlock', hashlock: args.hashlock }));
  process.exit(1);
}
const logData = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
console.log(JSON.stringify(logData, null, 2)); 