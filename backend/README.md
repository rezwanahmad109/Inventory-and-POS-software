# Inventory & POS Backend (NestJS + TypeORM)

NestJS backend for inventory, POS, finance, reporting, and warehouse operations.

## Setup
1. Copy `.env.example` to `.env` and configure PostgreSQL + auth values.
2. Install dependencies: `npm install`
3. Start in dev mode: `npm run start:dev`
4. API docs: `http://localhost:3000/api/docs`

## Build & Test
- Build: `npm run build`
- Test: `npm test`

## Core Modules
- `auth`: JWT login/session flow
- `dashboard`: KPIs, dues, payment metrics, top-selling products, chart series
- `products`: product catalog, stock adjustments, barcode search, per-product rate lists
- `price-tiers`: retail/wholesale/custom tier CRUD + product-tier pricing
- `branches` + `warehouses`: multi-warehouse stock, low-stock alerts, transfer lifecycle
- `sales` + `pos`: invoice/quotation flows, POS checkout, payments
- `purchases` + `purchase-returns`: bills/estimates, payment tracking, debit-note path
- `finance` + `wallets`: chart of accounts, journals, wallet transfers, reconciliation
- `settings` + `company-settings`: profile, logos, theme, currencies, timezone, invoice settings
- `taxes`, `units`, `subscription-plans`: full CRUD support
- `uploads`: attachment upload + signed download URLs + linking to expenses/invoices
- `notifications`: template CRUD + order/purchase/receipt email dispatch
- `reports`: JSON/CSV/PDF export endpoints

## Important Endpoints
- `GET /dashboard/summary`
- `POST /stock-transfers`
- `POST /stock-transfers/:id/approve`
- `POST /stock-transfers/:id/receive`
- `GET /warehouses/stock-levels`
- `POST /price-tiers`
- `PUT /price-tiers/:tierId/products/:productId`
- `POST /sales`
- `POST /sales/:id/payments`
- `POST /purchases`
- `POST /purchase-returns`
- `POST /pos/orders/:id/checkout`
- `POST /api/wallets/transfer`
- `POST /uploads/attachments`
- `GET /uploads/attachments/:id/signed-url`
- `POST /notifications/send`
- `GET /reports/sales-summary?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv`

## Example Requests
```bash
# 1) Create sale (invoice)
curl -X POST http://localhost:3000/sales \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "9ce4c560-1c63-4d0a-8c95-289f4ddf1a8f",
    "customerId": 7,
    "items": [
      {
        "productId": "f1d8969f-14ab-4938-9762-f505ac9d42de",
        "quantity": 2,
        "priceTierId": "6f7916f3-028f-4df8-92da-fb37f2af12a7"
      }
    ],
    "payments": [{ "method": "cash", "amount": 100 }]
  }'

# 2) Create stock transfer request -> approve -> receive
curl -X POST http://localhost:3000/stock-transfers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fromBranchId": "11111111-1111-1111-1111-111111111111",
    "toBranchId": "22222222-2222-2222-2222-222222222222",
    "productId": "f1d8969f-14ab-4938-9762-f505ac9d42de",
    "quantity": 5
  }'

curl -X POST http://localhost:3000/stock-transfers/<transferId>/approve \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{}'

curl -X POST http://localhost:3000/stock-transfers/<transferId>/receive \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{}'

# 3) Upload attachment and request signed URL
curl -X POST http://localhost:3000/uploads/attachments \
  -H "Authorization: Bearer <token>" \
  -F "file=@invoice.pdf" \
  -F "resourceType=sale_invoice" \
  -F "resourceId=<saleId>"

curl -X GET http://localhost:3000/uploads/attachments/<attachmentId>/signed-url \
  -H "Authorization: Bearer <token>"
```

## Notes
- Multi-step financial/inventory workflows run in explicit QueryRunner transactions.
- Operational accounting entries are posted through event-driven listeners to double-entry journals.
- Existing finance/wallet/chart-of-accounts modules are preserved and integrated.
