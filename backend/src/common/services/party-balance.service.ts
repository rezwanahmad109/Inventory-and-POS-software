import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { Customer } from '../../database/entities/customer.entity';
import { Supplier } from '../../database/entities/supplier.entity';

@Injectable()
export class PartyBalanceService {
  async adjustCustomerDue(
    manager: EntityManager,
    customerId: number,
    amountDelta: number,
  ): Promise<void> {
    if (amountDelta === 0) {
      return;
    }

    await manager
      .createQueryBuilder()
      .update(Customer)
      .set({ totalDue: () => `GREATEST(total_due + ${amountDelta}, 0)` })
      .where('id = :id', { id: customerId })
      .execute();
  }

  async adjustSupplierPayable(
    manager: EntityManager,
    supplierId: string,
    amountDelta: number,
  ): Promise<void> {
    if (amountDelta === 0) {
      return;
    }

    await manager
      .createQueryBuilder()
      .update(Supplier)
      .set({ totalPayable: () => `GREATEST(total_payable + ${amountDelta}, 0)` })
      .where('id = :id', { id: supplierId })
      .execute();
  }
}
