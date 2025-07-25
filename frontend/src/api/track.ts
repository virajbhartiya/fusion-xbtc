import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const hashlock = url.searchParams.get('hashlock');
  if (!hashlock) {
    return new Response(JSON.stringify({ error: 'Missing hashlock' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const logDir = path.resolve(process.cwd(), 'examples/swaps');
  const logPath = path.join(logDir, `${hashlock}.json`);
  try {
    const logData = await fs.readFile(logPath, 'utf-8');
    return new Response(logData, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'No log found for hashlock', hashlock }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
} 