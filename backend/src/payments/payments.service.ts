import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Customer } from '../database/entities/customer.entity';
import {
  Payment,
  PaymentMethodType,
  PaymentType,
} from '../database/entities/payment.entity';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly dataSource: DataSource,
  ) {}

  async recordDeposit(
    customerId: number,
    amount: number,
    method: PaymentMethodType,
    note?: string,
  ): Promise<Payment> {
    if (amount <= 0) {
      throw new BadRequestException('Deposit amount must be positive.');
    }

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id: customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!customer) {
        throw new NotFoundException(`Customer #${customerId} not found.`);
      }

      const payment = manager.create(Payment, {
        customerId,
        type: PaymentType.DEPOSIT,
        method,
        amount,
        note: note?.trim() || null,
        saleId: null,
      });
      const saved = await manager.save(payment);

      await manager
        .createQueryBuilder()
        .update(Customer)
        .set({ totalDeposit: () => 'total_deposit + :amount' })
        .where('id = :id', { id: customerId })
        .setParameters({ amount })
        .execute();

      return saved;
    });
  }

  async recordSaleDue(
    customerId: number,
    saleId: string,
    amount: number,
    method?: PaymentMethodType,
  ): Promise<Payment> {
    if (amount <= 0) {
      throw new BadRequestException('Due amount must be positive.');
    }

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id: customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!customer) {
        throw new NotFoundException(`Customer #${customerId} not found.`);
      }

      const payment = manager.create(Payment, {
        customerId,
        type: PaymentType.SALE_DUE,
        method: method ?? PaymentMethodType.CASH,
        amount,
        note: `Due from sale ${saleId}`,
        saleId,
      });
      const saved = await manager.save(payment);

      await manager
        .createQueryBuilder()
        .update(Customer)
        .set({ totalDue: () => 'total_due + :amount' })
        .where('id = :id', { id: customerId })
        .setParameters({ amount })
        .execute();

      return saved;
    });
  }

  async recordDuePayment(
    customerId: number,
    amount: number,
    method: PaymentMethodType,
    note?: string,
  ): Promise<Payment> {
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be positive.');
    }

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.findOne(Customer, {
        where: { id: customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!customer) {
        throw new NotFoundException(`Customer #${customerId} not found.`);
      }

      if (amount > customer.totalDue) {
        throw new BadRequestException(
          `Payment amount (${amount}) exceeds outstanding due (${customer.totalDue}).`,
        );
      }

      const payment = manager.create(Payment, {
        customerId,
        type: PaymentType.DUE_PAYMENT,
        method,
        amount,
        note: note?.trim() || null,
        saleId: null,
      });
      const saved = await manager.save(payment);

      await manager
        .createQueryBuilder()
        .update(Customer)
        .set({ totalDue: () => 'total_due - :amount' })
        .where('id = :id', { id: customerId })
        .setParameters({ amount })
        .execute();

      return saved;
    });
  }

  async findAll(query: PaymentQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 200);
    const skip = (page - 1) * limit;

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.customer', 'customer')
      .orderBy('payment.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.customerId) {
      qb.andWhere('payment.customer_id = :customerId', { customerId: query.customerId });
    }
    if (query.type) {
      qb.andWhere('payment.type = :type', { type: query.type });
    }
    if (query.method) {
      qb.andWhere('payment.method = :method', { method: query.method });
    }
    if (query.from) {
      qb.andWhere('payment.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('payment.created_at <= :to', { to: query.to });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByCustomer(customerId: number, from?: string, to?: string) {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException(`Customer #${customerId} not found.`);
    }

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.customer_id = :customerId', { customerId })
      .orderBy('payment.created_at', 'DESC');

    if (from) {
      const parsedFrom = new Date(from);
      if (Number.isNaN(parsedFrom.getTime())) {
        throw new BadRequestException('Invalid "from" date.');
      }
      qb.andWhere('payment.created_at >= :from', { from: parsedFrom.toISOString() });
    }
    if (to) {
      const parsedTo = new Date(to);
      if (Number.isNaN(parsedTo.getTime())) {
        throw new BadRequestException('Invalid "to" date.');
      }
      qb.andWhere('payment.created_at <= :to', { to: parsedTo.toISOString() });
    }

    return qb.getMany();
  }
}
