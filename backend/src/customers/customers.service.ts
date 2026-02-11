import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Customer } from '../database/entities/customer.entity';
import { Payment } from '../database/entities/payment.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  /**
   * Create a new customer. Enforces unique phone constraint.
   */
  async create(dto: CreateCustomerDto): Promise<Customer> {
    const normalizedPhone = dto.phone.trim();
    const existing = await this.customerRepository.findOne({
      where: { phone: normalizedPhone },
    });
    if (existing) {
      throw new ConflictException(`Customer with phone "${normalizedPhone}" already exists.`);
    }

    const customer = this.customerRepository.create({
      name: dto.name.trim(),
      phone: normalizedPhone,
      email: dto.email?.toLowerCase().trim() || null,
      address: dto.address?.trim() || null,
      totalDue: 0,
      totalDeposit: 0,
    });
    return this.customerRepository.save(customer);
  }

  /**
   * Paginated list of customers with optional search and sort.
   */
  async findAll(query: CustomerQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 200);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'DESC';

    const qb = this.customerRepository.createQueryBuilder('customer');

    if (query.search) {
      qb.where(
        'customer.name ILIKE :search OR customer.phone ILIKE :search',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy(`customer.${sortBy}`, order)
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single customer by ID with recent payments and sales summary.
   */
  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['payments', 'sales'],
    });
    if (!customer) {
      throw new NotFoundException(`Customer #${id} not found.`);
    }
    return customer;
  }

  /**
   * Update customer profile fields (not balances).
   */
  async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    if (dto.phone && dto.phone !== customer.phone) {
      const normalizedPhone = dto.phone.trim();
      const existing = await this.customerRepository.findOne({
        where: { phone: normalizedPhone },
      });
      if (existing) {
        throw new ConflictException(`Phone "${normalizedPhone}" is already in use.`);
      }

      customer.phone = normalizedPhone;
    }

    if (dto.name !== undefined) customer.name = dto.name.trim();
    if (dto.email !== undefined) customer.email = dto.email?.toLowerCase().trim() || null;
    if (dto.address !== undefined) customer.address = dto.address?.trim() || null;

    return this.customerRepository.save(customer);
  }

  /**
   * Remove a customer. Blocks deletion if outstanding due > 0.
   */
  async remove(id: number): Promise<void> {
    const customer = await this.findOne(id);
    if (customer.totalDue > 0) {
      throw new BadRequestException(
        `Cannot delete customer #${id} with outstanding due of ${customer.totalDue}.`,
      );
    }
    await this.customerRepository.remove(customer);
  }

  /**
   * Get full payment ledger for a customer within optional date range.
   */
  async getStatement(id: number, from?: string, to?: string) {
    await this.findOne(id); // validate existence

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.customer_id = :id', { id })
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

  /**
   * Atomically adjust customer balance using QueryBuilder increment/decrement.
   * Avoids read-then-write race conditions.
   */
  async adjustBalance(
    id: number,
    type: 'incrementDue' | 'decrementDue' | 'incrementDeposit',
    amount: number,
  ): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive.');
    }

    switch (type) {
      case 'incrementDue':
        await this.ensureCustomerExistsForBalanceAdjust(id);
        await this.customerRepository
          .createQueryBuilder()
          .update(Customer)
          .set({ totalDue: () => 'total_due + :amount' })
          .where('id = :id', { id })
          .setParameters({ amount })
          .execute();
        break;
      case 'decrementDue':
        const decrementResult = await this.customerRepository
          .createQueryBuilder()
          .update(Customer)
          .set({ totalDue: () => 'total_due - :amount' })
          .where('id = :id', { id })
          .andWhere('total_due >= :amount', { amount })
          .setParameters({ amount })
          .execute();
        if (!decrementResult.affected) {
          throw new BadRequestException(
            `Unable to reduce due balance for customer #${id}.`,
          );
        }
        break;
      case 'incrementDeposit':
        await this.ensureCustomerExistsForBalanceAdjust(id);
        await this.customerRepository
          .createQueryBuilder()
          .update(Customer)
          .set({ totalDeposit: () => 'total_deposit + :amount' })
          .where('id = :id', { id })
          .setParameters({ amount })
          .execute();
        break;
    }
  }

  private async ensureCustomerExistsForBalanceAdjust(id: number): Promise<void> {
    const exists = await this.customerRepository.exists({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Customer #${id} not found.`);
    }
  }
}
