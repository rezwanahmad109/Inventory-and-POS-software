import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletBalanceAdjustmentDto } from './dto/wallet-balance-adjustment.dto';
import { WalletTransactionQueryDto } from './dto/wallet-transaction-query.dto';
import { WalletTransferDto } from './dto/wallet-transfer.dto';
import { WalletsService } from './services/wallets.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @Permissions('wallets.create')
  @ApiOperation({ summary: 'Create wallet account' })
  create(@Body() dto: CreateWalletDto) {
    return this.walletsService.create(dto);
  }

  @Get()
  @Permissions('wallets.read')
  @ApiOperation({ summary: 'List wallets' })
  findAll() {
    return this.walletsService.findAll();
  }

  @Get(':walletId/transactions')
  @Permissions('wallets.read')
  @ApiOperation({ summary: 'List wallet transactions by date range' })
  findTransactions(
    @Param('walletId', new ParseUUIDPipe()) walletId: string,
    @Query() query: WalletTransactionQueryDto,
  ) {
    return this.walletsService.findTransactions(walletId, query);
  }

  @Post(':walletId/top-up')
  @Permissions('wallets.create')
  @ApiOperation({ summary: 'Increase wallet balance and write ledger transaction' })
  topUp(
    @Param('walletId', new ParseUUIDPipe()) walletId: string,
    @Body() dto: WalletBalanceAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.walletsService.topUp(walletId, dto, request.user.userId);
  }

  @Post(':walletId/withdraw')
  @Permissions('wallets.create')
  @ApiOperation({ summary: 'Decrease wallet balance and write ledger transaction' })
  withdraw(
    @Param('walletId', new ParseUUIDPipe()) walletId: string,
    @Body() dto: WalletBalanceAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.walletsService.withdraw(walletId, dto, request.user.userId);
  }

  @Post('transfer')
  @Permissions('wallets.create')
  @ApiOperation({ summary: 'Transfer funds between wallet accounts' })
  transfer(
    @Body() dto: WalletTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.walletsService.transfer(dto, request.user.userId);
  }
}
