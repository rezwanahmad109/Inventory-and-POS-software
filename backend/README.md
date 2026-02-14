# Inventory & POS Backend (NestJS + PostgreSQL)

Secure, modular NestJS backend for Inventory and POS operations.

## Stack
- NestJS (TypeScript)
- PostgreSQL + TypeORM
- JWT authentication
- Role-based authorization (`Admin`, `Manager`, `Cashier`)
- Swagger docs

## Quick Start
1. Copy `.env.example` to `.env` and set values.
2. Install dependencies:
   - `npm install`
3. Start dev server:
   - `npm run start:dev`
4. Open Swagger:
   - `http://localhost:3000/api/docs`

## Auth
- `POST /auth/login`
  - Validates credentials with bcrypt
  - Returns JWT token and user profile

## Roles
- Implemented with custom decorator + guard:
  - `@Roles(...)`
  - `JwtAuthGuard`
  - `RolesGuard`

## Product API
- `POST /products` (Admin, Manager)
- `GET /products` (Admin, Manager, Cashier)
- `GET /products/:id` (Admin, Manager, Cashier)
- `PATCH /products/:id` (Admin, Manager)
- `DELETE /products/:id` (Admin, Manager)

## Supplier API
- `GET /suppliers` (JWT protected)
- `POST /suppliers` (JWT protected)
- `PUT /suppliers/:id` (JWT protected)
- `DELETE /suppliers/:id` (JWT protected)

## Sales API
- `POST /sales` (Admin, Manager, Cashier)
  - Creates invoice
  - Generates `invoiceNumber`
  - Creates sale items
  - Auto-decrements stock in transaction
- `GET /sales` (Admin, Manager, Cashier)
- `GET /sales/:id` (Admin, Manager, Cashier)
- `PUT /sales/:id` (update invoice/quotation with stock rollback/reapply)
- `DELETE /sales/:id`
- `POST /sales/:id/payments` (partial/full payment tracking)
- `POST /sales/:id/convert` (quotation -> invoice)

## Purchase API
- `POST /purchases` (JWT protected)
  - Generates sequential invoice number (`PUR-0001`, ...)
  - Creates purchase items
  - Auto-increments stock in transaction
- `GET /purchases` (JWT protected)
- `GET /purchases/:id` (JWT protected)
- `PUT /purchases/:id`
- `POST /purchases/:id/payments`
- `POST /purchases/:id/convert` (estimate -> bill)
- `DELETE /purchases/:id` (JWT protected)
  - Reverses stock-in quantities before delete

## POS API
- `GET /pos/products/search`
- `POST /pos/orders`
- `PUT /pos/orders/:id`
- `POST /pos/orders/:id/hold`
- `POST /pos/orders/:id/resume`
- `POST /pos/orders/:id/checkout`
- `GET /pos/orders/:id/receipt`

## Cashflow API
- `POST /incoming-payments/sales/:saleId`
- `POST /outgoing-payments/purchases/:purchaseId`
- `POST /outgoing-payments/expenses/:expenseId`

## Wallet / Account Ledger API
- `GET /api/wallets`
- `GET /api/wallets/:walletId/transactions`
- `POST /api/wallets/:walletId/top-up`
- `POST /api/wallets/:walletId/withdraw`
- `POST /api/wallets/transfer`

## Reporting API
- `GET /reports/sales-summary`
- `GET /reports/purchase-summary`
- `GET /reports/stock-summary`
- `GET /reports/rate-list`
- `GET /reports/product-sales-summary`
- `GET /reports/users-report`
- `GET /reports/expense-summary`
- `GET /reports/profit-loss`
- Supports `format=json|csv|pdf` and returns download URLs for exported files.

## Database Entities
- `Role`
- `User` (`id`, `name`, `email`, `password`, `role`)
- `Product` (`id`, `name`, `sku`, `category`, `unit`, `price`, `stockQty`, `description`, `image`)
- `Sale` (`id`, `invoiceNumber`, `paymentMethod`, `totalAmount`, `createdAt`)
- `SaleItem`
- `Supplier`
- `Purchase`
- `PurchaseItem`

## Default Seed (Bootstrap)
On first startup:
- Seeds roles (`Admin`, `Manager`, `Cashier`)
- Seeds default admin user from env:
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - `ADMIN_NAME`
