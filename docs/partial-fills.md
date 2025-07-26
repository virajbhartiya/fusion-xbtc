# Partial Fill Support for HTLC Swaps

This feature enables users to fill HTLC orders with smaller amounts than the full order size, making the swap system more flexible and accessible.

## Overview

Partial fills allow:
- **Large orders** to be filled by multiple smaller transactions
- **Flexible liquidity** where users can contribute what they have available
- **Better market efficiency** by matching orders with available capital
- **Reduced barriers** to entry for smaller participants

## How It Works

### 1. Order Creation
When creating an HTLC order, you specify:
- `amount`: Total order size (in sats)
- `minFillAmount`: Minimum amount that can be filled in one transaction
- `maxFillAmount`: Maximum amount that can be filled in one transaction

### 2. Order States
- **`open`**: Order is available for fills
- **`partial`**: Order has been partially filled but still has remaining amount
- **`filled`**: Order has been completely filled

### 3. Fill Process
1. User specifies the amount they want to fill
2. System validates the fill amount against min/max limits
3. HTLC transaction is created and broadcast
4. Order is updated with remaining amount
5. Fill history is tracked

## Usage Examples

### Create an Order with Partial Fill Support

```bash
# Create order for 100,000 sats that can be filled in chunks of 10,000-50,000 sats
pnpm --filter cli exec ts-node create-order.ts \
  --orderId=order-001 \
  --amount=100000 \
  --minFillAmount=10000 \
  --maxFillAmount=50000 \
  --recipientAddress=tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z \
  --refundAddress=tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z \
  --locktime=3600 \
  --network=testnet
```

### List Orders

```bash
# List all orders
pnpm --filter cli exec ts-node list-orders.ts

# List only open orders
pnpm --filter cli exec ts-node list-orders.ts --status=open

# Get specific order details
pnpm --filter cli exec ts-node list-orders.ts --orderId=order-001 --format=json
```

### Fill an Order

```bash
# Fill 25,000 sats of the order
pnpm --filter cli exec ts-node partial-fill.ts \
  --orderId=order-001 \
  --fillAmount=25000 \
  --maxFillAmount=50000 \
  --recipientPubkey=0291de523acb2e4016266c7cae54dd01d4de143584851945d3926a4e75647279f1 \
  --refundPubkey=0291de523acb2e4016266c7cae54dd01d4de143584851945d3926a4e75647279f1 \
  --locktime=3600 \
  --utxos='[{"txid":"818f6764b8a1705517122a6692213a712ca4cdaf593a16ad5a1a17113dde7d62","vout":1,"amount":104689,"wif":"cVTqEAVYb5Mu7GwJPirVS6GzG2saQLfbyqNVZJGUivQXofJ8mKSC"}]' \
  --changeAddress=tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z \
  --feeSats=1000 \
  --electrumHost=testnet.hsmiths.com \
  --electrumPort=53011 \
  --network=testnet
```

## Order Structure

```json
{
  "orderId": "order-001",
  "amount": 100000,
  "remainingAmount": 75000,
  "minFillAmount": 10000,
  "maxFillAmount": 50000,
  "recipientAddress": "tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z",
  "refundAddress": "tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z",
  "secret": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "hashlock": "0x4c57b773ddd36d4e24eaff0d0e0e07e74a52e043bf030a76f4fd139c02e9238e",
  "locktime": 3600,
  "network": "testnet",
  "chain": "bitcoin",
  "status": "partial",
  "fills": [
    {
      "fillId": "order-001-1703123456789",
      "amount": 25000,
      "txid": "0000000000000000000000000000000000000000000000000000000000000000",
      "timestamp": 1703123456789,
      "htlcAddress": "tb1q4anyqhfgdpyusnj5zhfge28322aka8vjdztu6z",
      "redeemScript": "a91469187648b135a4008639fef34ea80feebc91ddb387"
    }
  ],
  "createdAt": 1703123456000,
  "updatedAt": 1703123456789
}
```

## Validation Rules

### Order Creation
- `amount` must be > 0
- `minFillAmount` must be > 0
- `maxFillAmount` must be > 0
- `minFillAmount` ≤ `maxFillAmount`
- `maxFillAmount` ≤ `amount`

### Fill Validation
- Order status must be `open` or `partial`
- Fill amount must be ≥ `minFillAmount`
- Fill amount must be ≤ `maxFillAmount`
- Fill amount must be ≤ `remainingAmount`
- Fill amount must be > 0

## Security Considerations

1. **Secret Management**: Each order has a unique secret that must be kept secure
2. **Hashlock Consistency**: All fills for an order use the same hashlock
3. **Timelock Enforcement**: All HTLCs use the same locktime from the original order
4. **Fill Tracking**: Complete audit trail of all fills and remaining amounts

## Use Cases

### 1. Large Order Liquidity
- Create a 1,000,000 sat order
- Allow fills of 50,000-200,000 sats
- Multiple participants can contribute

### 2. Flexible Participation
- Create a 50,000 sat order
- Allow fills of 5,000-25,000 sats
- Small participants can still contribute

### 3. Gradual Filling
- Create a 100,000 sat order
- Allow fills of 10,000-100,000 sats
- Can be filled in one transaction or multiple smaller ones

## Commands Reference

| Command | Description |
|---------|-------------|
| `create-order.ts` | Create a new HTLC order with partial fill support |
| `list-orders.ts` | List and manage HTLC orders |
| `partial-fill.ts` | Fill a portion of an existing order |

## Files

- `cli/create-order.ts` - Order creation script
- `cli/list-orders.ts` - Order management script  
- `cli/partial-fill.ts` - Partial fill execution script
- `cli-partial-fill-commands.sh` - Example commands
- `examples/swaps/` - Order storage directory 