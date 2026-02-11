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

## Purchase API
- `POST /purchases` (JWT protected)
  - Generates sequential invoice number (`PUR-0001`, ...)
  - Creates purchase items
  - Auto-increments stock in transaction
- `GET /purchases` (JWT protected)
- `GET /purchases/:id` (JWT protected)
- `DELETE /purchases/:id` (JWT protected)
  - Reverses stock-in quantities before delete

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
