# Sale Integration with Customer Credit System

When creating a sale with a linked customer and a due amount, modify the existing
`SalesService.create()` method to integrate with the payments system.

## Required Changes to `SalesService`

### 1. Inject PaymentsService

```typescript
// In sales.module.ts — add PaymentsModule to imports:
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Product]),
    PaymentsModule, // <-- add this
  ],
  // ...
})

// In sales.service.ts — inject PaymentsService:
constructor(
  @InjectRepository(Sale)
  private readonly saleRepository: Repository<Sale>,
  // ... existing injections ...
  private readonly paymentsService: PaymentsService, // <-- add this
) {}
```

### 2. Modify the create() method

After saving the sale, check if it has a `customerId` and `dueAmount > 0`:

```typescript
async create(dto: CreateSaleDto): Promise<Sale> {
  // ... existing sale creation logic ...

  // Calculate paid and due amounts
  const paidAmount = dto.paidAmount ?? sale.totalAmount;
  const dueAmount = sale.totalAmount - paidAmount;

  sale.paidAmount = paidAmount;
  sale.dueAmount = dueAmount;

  // If a customer is linked, also set the customerId
  if (dto.customerId) {
    sale.customerId = dto.customerId;
  }

  const savedSale = await this.saleRepository.save(sale);

  // If there's a due amount and a linked customer, record it in the payment ledger
  if (savedSale.customerId && savedSale.dueAmount > 0) {
    await this.paymentsService.recordSaleDue(
      savedSale.customerId,
      savedSale.id,
      savedSale.dueAmount,
    );
  }

  return savedSale;
}
```

### 3. Update CreateSaleDto

Add optional fields to the existing DTO:

```typescript
@IsOptional()
@IsNumber()
customerId?: number;

@IsOptional()
@IsNumber()
@Min(0)
paidAmount?: number;
```

The `dueAmount` is calculated as `totalAmount - paidAmount` and should not be
provided directly by the client.
