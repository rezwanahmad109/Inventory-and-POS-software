import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { RoleName } from '../common/enums/role-name.enum';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ExpenseCategory } from '../database/entities/expense-category.entity';
import { Expense } from '../database/entities/expense.entity';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expensesRepository: Repository<Expense>,
    @InjectRepository(ExpenseCategory)
    private readonly expenseCategoriesRepository: Repository<ExpenseCategory>,
  ) {}

  async create(createExpenseDto: CreateExpenseDto, userId: string): Promise<Expense> {
    const categoryName = await this.ensureCategory(createExpenseDto.category);

    const expense = this.expensesRepository.create({
      ...createExpenseDto,
      category: categoryName,
      date: new Date(createExpenseDto.date),
      note: createExpenseDto.note?.trim() ?? null,
      attachments: this.normalizeAttachmentUrls(createExpenseDto.attachmentUrls),
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
      updateData.category = await this.ensureCategory(updateExpenseDto.category);
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
    if ((updateExpenseDto as CreateExpenseDto).attachmentUrls !== undefined) {
      updateData.attachments = this.normalizeAttachmentUrls(
        (updateExpenseDto as CreateExpenseDto).attachmentUrls,
      );
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

  async listCategories(): Promise<ExpenseCategory[]> {
    return this.expenseCategoriesRepository.find({
      order: { name: 'ASC' },
    });
  }

  async createCategory(
    dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const existing = await this.expenseCategoriesRepository.findOne({
      where: { name: ILike(dto.name.trim()) },
    });

    if (existing) {
      return existing;
    }

    const category = this.expenseCategoriesRepository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      isActive: dto.isActive !== false,
    });
    return this.expenseCategoriesRepository.save(category);
  }

  async updateCategory(
    id: string,
    dto: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const category = await this.expenseCategoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Expense category "${id}" not found.`);
    }

    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      category.description = dto.description?.trim() ?? null;
    }
    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    return this.expenseCategoriesRepository.save(category);
  }

  async removeCategory(id: string): Promise<void> {
    const category = await this.expenseCategoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Expense category "${id}" not found.`);
    }

    category.isActive = false;
    await this.expenseCategoriesRepository.save(category);
  }

  private normalizeAttachmentUrls(urls?: string[]): string[] | null {
    if (!urls || urls.length === 0) {
      return null;
    }

    const normalized = Array.from(
      new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)),
    );
    return normalized.length > 0 ? normalized : null;
  }

  private async ensureCategory(input: string): Promise<string> {
    const normalized = input.trim();
    const existing = await this.expenseCategoriesRepository.findOne({
      where: { name: ILike(normalized) },
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        await this.expenseCategoriesRepository.save(existing);
      }
      return existing.name;
    }

    const created = this.expenseCategoriesRepository.create({
      name: normalized,
      description: null,
      isActive: true,
    });
    await this.expenseCategoriesRepository.save(created);
    return created.name;
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
