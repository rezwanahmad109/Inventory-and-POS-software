import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Permissions('expenses.create')
  @ApiOperation({ summary: 'Create a new expense' })
  @ApiResponse({ status: 201, description: 'Expense created' })
  async create(
    @Body() createExpenseDto: CreateExpenseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user?.userId) {
      throw new NotFoundException('Authenticated user context is missing.');
    }

    return this.expensesService.create(createExpenseDto, req.user.userId);
  }

  @Get()
  @Permissions('expenses.read')
  @ApiOperation({ summary: 'List expenses with filters and pagination' })
  @ApiQuery({ name: 'from', required: false, example: '2023-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2023-12-31' })
  @ApiQuery({ name: 'paidBy', required: false, example: 'Cash' })
  @ApiQuery({ name: 'category', required: false, example: 'Office Supplies' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('paidBy') paidBy?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedFrom && Number.isNaN(parsedFrom.getTime())) {
      throw new BadRequestException('Invalid "from" date.');
    }
    if (parsedTo && Number.isNaN(parsedTo.getTime())) {
      throw new BadRequestException('Invalid "to" date.');
    }

    const parsedPage = page ? Number.parseInt(page, 10) : undefined;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;

    const query = {
      from: parsedFrom,
      to: parsedTo,
      paidBy,
      category,
      page: parsedPage && parsedPage > 0 ? parsedPage : undefined,
      limit: parsedLimit && parsedLimit > 0 ? Math.min(parsedLimit, 200) : undefined,
    };
    return this.expensesService.findAll(query);
  }

  @Get(':id')
  @Permissions('expenses.read')
  @ApiOperation({ summary: 'Get expense by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expensesService.findOne(id);
  }

  @Put(':id')
  @Permissions('expenses.update')
  @ApiOperation({ summary: 'Update expense' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.expensesService.update(id, updateExpenseDto, req.user);
  }

  @Delete(':id')
  @Permissions('expenses.delete')
  @ApiOperation({ summary: 'Soft delete expense' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.expensesService.remove(id, req.user);
  }

  @Get('/categories/list')
  @Permissions('expenses.read')
  @ApiOperation({ summary: 'List expense categories' })
  listCategories() {
    return this.expensesService.listCategories();
  }

  @Post('/categories/list')
  @Permissions('expenses.create')
  @ApiOperation({ summary: 'Create expense category' })
  createCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.expensesService.createCategory(dto);
  }

  @Put('/categories/list/:id')
  @Permissions('expenses.update')
  @ApiOperation({ summary: 'Update expense category' })
  updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.expensesService.updateCategory(id, dto);
  }

  @Delete('/categories/list/:id')
  @Permissions('expenses.delete')
  @ApiOperation({ summary: 'Deactivate expense category' })
  async removeCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.expensesService.removeCategory(id);
    return { message: 'Expense category deactivated successfully.' };
  }
}
