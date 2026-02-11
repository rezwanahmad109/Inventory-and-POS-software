import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { RoleName } from '../common/enums/role-name.enum';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { Expense } from '../database/entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expensesRepository: Repository<Expense>,
  ) {}

  async create(createExpenseDto: CreateExpenseDto, userId: string): Promise<Expense> {
    const expense = this.expensesRepository.create({
      ...createExpenseDto,
      date: new Date(createExpenseDto.date),
      note: createExpenseDto.note?.trim() ?? null,
      createdById: userId,
    });

    return this.expensesRepository.save(expense);
  }

  async findAll(query: {
    from?: Date;
    to?: Date;
    paidBy?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<Expense[]> {
    const { from, to, paidBy, category, page = 1, limit = 10 } = query;

    const where: Record<string, unknown> = {};
    if (paidBy) where.paidBy = paidBy;
    if (category) where.category = category;

    let dateCondition;
    if (from && to) {
      dateCondition = Between(from, to);
    } else if (from) {
      dateCondition = MoreThanOrEqual(from);
    } else if (to) {
      dateCondition = LessThanOrEqual(to);
    }
    if (dateCondition) where.date = dateCondition;

    return this.expensesRepository.find({
      where,
      order: { date: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      withDeleted: false,
    });
  }

  async findOne(id: number): Promise<Expense> {
    const expense = await this.expensesRepository.findOne({
      where: { id },
      withDeleted: false,
    });
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }
    return expense;
  }

  async update(
    id: number,
    updateExpenseDto: UpdateExpenseDto,
    requestUser: RequestUser,
  ): Promise<Expense> {
    const expense = await this.findOne(id);

    if (!this.canManageExpense(requestUser, expense)) {
      throw new ForbiddenException('You can only update your own expenses');
    }

    const updateData: Partial<Expense> = {};
    if (updateExpenseDto.title !== undefined) {
      updateData.title = updateExpenseDto.title.trim();
    }
    if (updateExpenseDto.category !== undefined) {
      updateData.category = updateExpenseDto.category.trim();
    }
    if (updateExpenseDto.amount !== undefined) {
      updateData.amount = updateExpenseDto.amount;
    }
    if (updateExpenseDto.paidBy !== undefined) {
      updateData.paidBy = updateExpenseDto.paidBy.trim();
    }
    if (updateExpenseDto.date !== undefined) {
      updateData.date = new Date(updateExpenseDto.date);
    }
    if (updateExpenseDto.note !== undefined) {
      updateData.note = updateExpenseDto.note?.trim() ?? null;
    }

    await this.expensesRepository.update(id, updateData);

    return this.findOne(id);
  }

  async remove(id: number, requestUser: RequestUser): Promise<void> {
    const expense = await this.findOne(id);

    if (!this.canManageExpense(requestUser, expense)) {
      throw new ForbiddenException('You can only delete your own expenses');
    }

    await this.expensesRepository.softDelete(id);
  }

  private canManageExpense(requestUser: RequestUser, expense: Expense): boolean {
    if (expense.createdById === requestUser.userId) {
      return true;
    }

    const roles = new Set<string>([
      requestUser.role?.toLowerCase().trim() ?? '',
      ...(requestUser.roles ?? []).map((role) => role.toLowerCase().trim()),
    ]);

    return roles.has(RoleName.ADMIN) || roles.has(RoleName.SUPER_ADMIN);
  }
}
