// Fusion+ Order Management API
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    switch (action) {
      case 'list':
        return await listFusionOrders();
      case 'get':
        const orderId = url.searchParams.get('orderId');
        if (!orderId) {
          return new Response(JSON.stringify({ error: 'Missing orderId' }), { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
          });
        }
        return await getFusionOrder(orderId);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

async function listFusionOrders() {
  try {
    const ordersDir = path.resolve(process.cwd(), 'examples/fusion-swaps');
    const files = await fs.readdir(ordersDir);
    const orders = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const orderPath = path.join(ordersDir, file);
        const orderData = await fs.readFile(orderPath, 'utf-8');
        const order = JSON.parse(orderData);
        orders.push(order);
      }
    }
    
    return new Response(JSON.stringify(orders), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    // If directory doesn't exist, return empty list
    return new Response(JSON.stringify([]), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

async function getFusionOrder(orderId: string) {
  try {
    const ordersDir = path.resolve(process.cwd(), 'examples/fusion-swaps');
    const orderPath = path.join(ordersDir, `${orderId}.json`);
    const orderData = await fs.readFile(orderPath, 'utf-8');
    const order = JSON.parse(orderData);
    
    return new Response(JSON.stringify(order), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Order not found' }), { 
      status: 404, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
} 